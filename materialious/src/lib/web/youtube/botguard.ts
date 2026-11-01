import type Innertube from 'youtubei.js';
import { getHeaders } from 'bgutils-js/utils';

/**
 * Playback tokens minted by BotGuard running in this browser, for a signed-in
 * session.
 *
 * Signed in, YouTube will not accept a token minted on the server - in a
 * simulated browser, from an address it bot-checks - and marks the stream
 * "attestation pending": it sends about a minute as grace and then nothing.
 * Anonymously the server's tokens are accepted, so only a signed-in session
 * comes here.
 *
 * BotGuard is Google's own script, so it runs in a sandboxed frame of its own:
 * an opaque origin, which can reach neither this site's storage nor the saved
 * account. All it is given is the challenge, and all it hands back is the
 * snapshot and the tokens; the requests to YouTube are made from here.
 */

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

/** How long a minter is used before a fresh challenge is asked for. */
const MINTER_LIFETIME_MS = 30 * 60 * 1000;

const VM_TIMEOUT_MS = 10_000;

/** Runs inside the sandbox; a plain function so it can be written out as source. */
function frameMain(): void {
	const toBytes = (base64: string) =>
		Uint8Array.from(atob(base64.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
	const toWebsafe = (bytes: Uint8Array) =>
		btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, '-')
			.replace(/\//g, '_');

	const signalOutput: unknown[] = [];
	let mint: ((binding: Uint8Array) => Promise<Uint8Array>) | undefined;

	window.addEventListener('message', async (event) => {
		const { id, op } = event.data ?? {};
		const reply = (data: Record<string, unknown>) => parent.postMessage({ id, ...data }, '*');

		try {
			if (op === 'snapshot') {
				new Function(event.data.interpreter)();
				const vm = (window as unknown as Record<string, any>)[event.data.globalName];
				if (!vm?.a) throw new Error('BotGuard unavailable');

				const snapshot = await new Promise<(...args: unknown[]) => void>((resolve) => {
					const noop = () => {};
					vm.a(
						event.data.program,
						(asyncSnapshot: (...args: unknown[]) => void) => resolve(asyncSnapshot),
						true,
						undefined,
						noop,
						[[], []],
						undefined,
						false,
						[noop, noop, noop, noop, noop]
					);
				});

				const response = await new Promise<string>((resolve) =>
					snapshot(resolve, [undefined, undefined, signalOutput, undefined])
				);
				reply({ response });
			} else if (op === 'minter') {
				const getMinter = signalOutput[0] as
					| ((token: Uint8Array) => Promise<(binding: Uint8Array) => Promise<Uint8Array>>)
					| undefined;
				if (!getMinter) throw new Error('No minter');
				mint = await getMinter(toBytes(event.data.integrityToken));
				reply({});
			} else if (op === 'mint') {
				if (!mint) throw new Error('No minter');
				const token = await mint(new TextEncoder().encode(event.data.binding));
				reply({ token: toWebsafe(token) });
			}
		} catch (error) {
			reply({ error: String(error) });
		}
	});
}

interface Minter {
	session: Innertube;
	createdAt: number;
	call: (op: string, data?: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

let current: Promise<Minter> | undefined;
let currentSession: Innertube | undefined;

async function createMinter(session: Innertube): Promise<Minter> {
	const frame = document.createElement('iframe');
	frame.setAttribute('sandbox', 'allow-scripts');
	frame.style.display = 'none';
	frame.srcdoc = `<!doctype html><script>(${frameMain.toString()})()</script>`;

	const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
	document.body.appendChild(frame);
	await loaded;

	let nextId = 0;
	const call = (op: string, data: Record<string, unknown> = {}) =>
		new Promise<Record<string, unknown>>((resolve, reject) => {
			const id = ++nextId;
			const timer = setTimeout(() => {
				window.removeEventListener('message', listener);
				reject(new Error(`BotGuard ${op} timed out`));
			}, VM_TIMEOUT_MS);

			const listener = (event: MessageEvent) => {
				if (event.source !== frame.contentWindow || event.data?.id !== id) return;
				window.removeEventListener('message', listener);
				clearTimeout(timer);
				if (event.data.error) reject(new Error(event.data.error));
				else resolve(event.data);
			};

			window.addEventListener('message', listener);
			frame.contentWindow?.postMessage({ id, op, ...data }, '*');
		});

	// The challenge YouTube sets this session, signed in as it is.
	const attestation = await session.actions.execute('/att/get', {
		engagementType: 'ENGAGEMENT_TYPE_UNBOUND',
		parse: false
	});
	const data = (
		typeof attestation.data === 'string' ? JSON.parse(attestation.data) : attestation.data
	) as {
		bgChallenge?: {
			program?: string;
			globalName?: string;
			interpreterUrl?: { privateDoNotAccessOrElseTrustedResourceUrlWrappedValue?: string };
		};
	};
	const challenge = data?.bgChallenge;
	const interpreterUrl =
		challenge?.interpreterUrl?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
	if (!challenge?.program || !challenge.globalName || !interpreterUrl) {
		throw new Error('No BotGuard challenge');
	}

	const interpreter = await (await fetch(`https:${interpreterUrl}`)).text();
	const { response } = await call('snapshot', {
		interpreter,
		program: challenge.program,
		globalName: challenge.globalName
	});

	const generated = await fetch('https://www.youtube.com/api/jnn/v1/GenerateIT', {
		method: 'POST',
		headers: getHeaders(),
		body: JSON.stringify([REQUEST_KEY, response])
	});
	const [integrityToken] = (await generated.json()) as [string?];
	if (!integrityToken) throw new Error('No integrity token');

	await call('minter', { integrityToken });

	return { session, createdAt: Date.now(), call };
}

/** A playback token bound to `binding`, minted in this browser for `session`. */
export async function mintInBrowser(session: Innertube, binding: string): Promise<string> {
	const stale = async () => {
		const minter = await current!;
		return Date.now() - minter.createdAt > MINTER_LIFETIME_MS;
	};

	if (!current || currentSession !== session || (await stale().catch(() => true))) {
		currentSession = session;
		current = createMinter(session);
		current.catch(() => {
			if (currentSession === session) current = undefined;
		});
	}

	const { token } = await (await current).call('mint', { binding });
	return token as string;
}
