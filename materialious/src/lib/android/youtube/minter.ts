import { BG, buildURL, GOOG_API_KEY, type WebPoSignalOutput } from 'bgutils-js';
import type { IBotguardChallenge } from 'youtubei.js';

export async function androidPoTokenMinter(
	bgChallenge: IBotguardChallenge,
	requestKey: string,
	visitorData: string
): Promise<string> {
	const interpreterUrl =
		bgChallenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
	const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
	const interpreterJavascript = await bgScriptResponse.text();

	if (interpreterJavascript) {
		new Function(interpreterJavascript)();
	} else throw new Error('Could not load VM');

	const botguardClient = await BG.BotGuardClient.create({
		program: bgChallenge.program,
		globalName: bgChallenge.global_name,
		globalObj: globalThis
	});

	const webPoSignalOutput: WebPoSignalOutput = [];
	const botguardResponse = await botguardClient.snapshot({ webPoSignalOutput });

	const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
		method: 'POST',
		headers: {
			'content-type': 'application/json+protobuf',
			'x-goog-api-key': GOOG_API_KEY,
			'x-user-agent': 'grpc-web-javascript/0.1'
		},
		body: JSON.stringify([requestKey, botguardResponse])
	});

	const integrityTokenResponseData = await integrityTokenResponse.json();

	if (typeof integrityTokenResponseData[0] !== 'string')
		throw new Error('Could not get integrity token');

	const integrityToken = integrityTokenResponseData[0];

	const integrityTokenBasedMinter = await BG.WebPoMinter.create(
		{ integrityToken },
		webPoSignalOutput
	);

	return await integrityTokenBasedMinter.mintAsWebsafeString(decodeURIComponent(visitorData));
}
