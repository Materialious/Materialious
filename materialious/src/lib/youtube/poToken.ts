import { BotGuardClient } from 'bgutils-js/botguard';
import { WebPoMinter } from 'bgutils-js/webpo';
import { buildURL, getHeaders, parseLooseJSON, USER_AGENT } from 'bgutils-js/utils';
import type { WebPoSignalOutput } from 'bgutils-js/shared-types';
import type { IRawResponse } from 'youtubei.js';

export interface InnerTubeChallenge {
	ytConfig: string;
	challengeResponse: IRawResponse;
	interpreterJavascript: string;
}

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

let cachedChallenge: { fetchedAt: number; challenge: InnerTubeChallenge } | undefined;

export async function fetchInnerTubeChallenge(): Promise<InnerTubeChallenge> {
	if (cachedChallenge && Date.now() - cachedChallenge.fetchedAt < CHALLENGE_TTL_MS) {
		return cachedChallenge.challenge;
	}

	const pageResponse = await fetch('https://www.youtube.com', {
		headers: {
			accept: '*/*',
			'accept-language': 'en-US,en;q=0.7',
			'user-agent': USER_AGENT
		}
	});

	if (!pageResponse.ok) {
		throw new Error('Unable to fetch YouTube page');
	}

	const pageHtml = await pageResponse.text();

	const ytConfig = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
	if (!ytConfig) {
		throw new Error('Could not find ytcfg in page HTML');
	}

	const initialAttestationData = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
	if (!initialAttestationData) {
		throw new Error('Could not find challenge in page HTML');
	}

	const initialAttestationDataJson = parseLooseJSON(initialAttestationData[1]);
	const challengeResponse = initialAttestationDataJson.R as IRawResponse;

	if (!challengeResponse.bgChallenge) {
		throw new Error('Could not get BotGuard challenge');
	}

	const interpreterUrl =
		challengeResponse.bgChallenge.interpreterUrl
			.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;

	const bgScriptResponse = await fetch(`https:${interpreterUrl}`);

	if (!bgScriptResponse.ok) {
		throw new Error('Unable to fetch interpreter');
	}

	const interpreterJavascript = await bgScriptResponse.text();

	if (!interpreterJavascript) {
		throw new Error('Could not load VM');
	}

	const challenge: InnerTubeChallenge = { ytConfig, challengeResponse, interpreterJavascript };
	cachedChallenge = { fetchedAt: Date.now(), challenge };

	return challenge;
}

export async function mintPoToken(
	requestKey: string,
	visitorData: string,
	challengeResponse: IRawResponse
): Promise<string> {
	if (!challengeResponse.bgChallenge) {
		throw new Error('Could not get BotGuard challenge');
	}

	const botGuardClient = await BotGuardClient.create({
		program: challengeResponse.bgChallenge.program,
		globalName: challengeResponse.bgChallenge.globalName,
		globalObject: globalThis
	});

	const webPoSignalOutput: WebPoSignalOutput = [];
	const botguardResponse = await botGuardClient.snapshot({ webPoSignalOutput });

	const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
		method: 'POST',
		headers: getHeaders(),
		body: JSON.stringify([requestKey, botguardResponse])
	});

	const integrityTokenJson = (await integrityTokenResponse.json()) as [
		string,
		number,
		number,
		string
	];

	const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] =
		integrityTokenJson;

	if (!integrityToken) {
		throw new Error('Could not get integrity token');
	}

	const webPoMinter = await WebPoMinter.create(
		{ integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken },
		webPoSignalOutput
	);

	return await webPoMinter.mintAsWebsafeString(decodeURIComponent(visitorData));
}
