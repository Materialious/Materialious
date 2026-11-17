export type InvidiousCredentials = { instance: string; username: string; password: string };
export type InvidiousSession = { username: string; token: string; instance?: string };
export type InvidiousLoginError = 'credentials' | 'challenge' | 'network' | 'instance';
export type InvidiousLoginResult =
	{ ok: true; session: InvidiousSession } | { ok: false; error: InvidiousLoginError };

export type InvidiousTransport = (
	url: string,
	options: { method: 'GET' | 'POST'; body?: string; sid?: string }
) => Promise<{ status: number; cookies: string[]; data?: unknown }>;

export async function requestInvidious(
	url: string,
	options: Parameters<InvidiousTransport>[1]
): ReturnType<InvidiousTransport> {
	const headers = new Headers();
	if (options.body) headers.set('Content-Type', 'application/x-www-form-urlencoded');
	if (options.sid) headers.set('Cookie', options.sid);
	const response = await fetch(url, {
		method: options.method,
		body: options.body,
		headers,
		redirect: 'manual',
		signal: AbortSignal.timeout(10000)
	});
	const cookies = response.headers.getSetCookie();
	if (options.method === 'GET' && response.ok) {
		return { status: response.status, cookies, data: await response.json() };
	}
	await response.body?.cancel();
	return { status: response.status, cookies };
}

// The HTML login route can also register unknown users. Invidious has no
// login-only parameter, so callers must explain this before submitting.
export async function loginInvidious(
	credentials: InvidiousCredentials,
	request: InvidiousTransport = requestInvidious
): Promise<InvidiousLoginResult> {
	let instance: URL;
	try {
		instance = new URL(credentials.instance);
		if (
			!['http:', 'https:'].includes(instance.protocol) ||
			instance.username ||
			instance.password
		) {
			return { ok: false, error: 'instance' };
		}
		instance.search = '';
		instance.hash = '';
	} catch {
		return { ok: false, error: 'instance' };
	}
	if (!credentials.username.trim() || !credentials.password) {
		return { ok: false, error: 'credentials' };
	}
	const base = instance.toString().replace(/\/$/, '');
	try {
		const response = await request(`${base}/login?type=invidious`, {
			method: 'POST',
			body: new URLSearchParams({
				email: credentials.username.trim(),
				password: credentials.password,
				action: 'signin'
			}).toString()
		});
		if (response.status === 401 || response.status === 403) {
			return { ok: false, error: 'credentials' };
		}
		if (response.status >= 400) return { ok: false, error: 'instance' };
		const sid = response.cookies
			.map((cookie) => cookie.split(';', 1)[0].trim())
			.find((cookie) => /^SID=[^\s;,]+$/.test(cookie));
		if (!sid) return { ok: false, error: 'challenge' };
		const verification = await request(`${base}/api/v1/auth/subscriptions`, {
			method: 'GET',
			sid
		});
		if (verification.status !== 200 || !Array.isArray(verification.data)) {
			return { ok: false, error: 'credentials' };
		}
		return {
			ok: true,
			session: { username: credentials.username.trim().toLowerCase(), token: sid, instance: base }
		};
	} catch {
		return { ok: false, error: 'network' };
	}
}
