import { BG, buildURL, GOOG_API_KEY, type WebPoSignalOutput } from 'bgutils-js';

export async function androidPoTokenMinter(
	requestKey: string,
	visitorData: string
): Promise<string> {
	const challengeResponse = await fetch(buildURL('Create', true), {
		method: 'POST',
		headers: {
			'content-type': 'application/json+protobuf',
			'x-goog-api-key': GOOG_API_KEY,
			'x-user-agent': 'grpc-web-javascript/0.1'
		},
		body: JSON.stringify([requestKey])
	});

	const challengeResponseData = await challengeResponse.json();
	const bgChallenge = BG.Challenge.parseChallengeData(challengeResponseData);

	if (!bgChallenge) throw new Error('Unable to parse challenge data');

	const interpreterJavascript =
		bgChallenge.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;

	if (!interpreterJavascript) {
		throw new Error(
			`Could not get integrity token. Interpreter Hash: ${bgChallenge.interpreterHash}`
		);
	}

	if (!document.getElementById(bgChallenge.interpreterHash)) {
		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.id = bgChallenge.interpreterHash;
		script.textContent = interpreterJavascript;
		document.head.appendChild(script);
	}

	const botguardClient = await BG.BotGuardClient.create({
		globalObj: globalThis,
		globalName: bgChallenge.globalName,
		program: bgChallenge.program
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
		throw new Error(
			`Could not get integrity token. Interpreter Hash: ${bgChallenge.interpreterHash}`
		);
	}

	const integrityTokenBasedMinter = await BG.WebPoMinter.create(
		{ integrityToken },
		webPoSignalOutput
	);
	return await integrityTokenBasedMinter.mintAsWebsafeString(decodeURIComponent(visitorData));
}
