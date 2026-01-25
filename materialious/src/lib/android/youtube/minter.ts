import { BG, buildURL, GOOG_API_KEY, USER_AGENT, type WebPoSignalOutput } from 'bgutils-js';
import type { IGetChallengeResponse } from 'youtubei.js';

export async function androidPoTokenMinter(
	requestKey: string,
	visitorData: string,
	challenge: IGetChallengeResponse
): Promise<string> {
	if (!challenge.bg_challenge) {
		throw new Error('No BotGuard Token');
	}

	const interpreterUrl =
		challenge.bg_challenge.interpreter_url
			.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
	const interpreterHash = challenge.bg_challenge.interpreter_hash;

	if (!interpreterUrl || !interpreterHash) {
		throw new Error(
			`Could not get integrity token. Interpreter Hash: ${challenge.bg_challenge?.interpreter_hash}`
		);
	}

	if (!document.getElementById(interpreterHash)) {
		const interpreterResponse = await fetch(`https:${interpreterUrl}`, {
			headers: {
				'user-agent': USER_AGENT
			}
		});
		if (!interpreterResponse.ok) {
			throw new Error('Unable to fetch interpreter');
		}

		const interpreterJavascript = await interpreterResponse.text();

		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.id = interpreterHash;
		script.textContent = interpreterJavascript;
		document.head.appendChild(script);
	}

	const botguardClient = await BG.BotGuardClient.create({
		program: challenge.bg_challenge.program,
		globalName: challenge.bg_challenge.global_name,
		globalObj: globalThis
	});

	const webPoSignalOutput: WebPoSignalOutput = [];
	const botguardResponse = await botguardClient.snapshot({ webPoSignalOutput });

	const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
		method: 'POST',
		headers: {
			'content-type': 'application/json+protobuf',
			'x-goog-api-key': GOOG_API_KEY,
			'x-user-agent': 'grpc-web-javacript/0.1'
		},
		body: JSON.stringify([requestKey, botguardResponse])
	});

	const integrityTokenResponseData = await integrityTokenResponse.json();
	const integrityToken = integrityTokenResponseData[0] as string | undefined;

	if (!integrityToken) {
		throw new Error(`Could not get integrity token. Interpreter Hash: ${interpreterHash}`);
	}

	const integrityTokenBasedMinter = await BG.WebPoMinter.create(
		{ integrityToken },
		webPoSignalOutput
	);
	return await integrityTokenBasedMinter.mintAsWebsafeString(decodeURIComponent(visitorData));
}
