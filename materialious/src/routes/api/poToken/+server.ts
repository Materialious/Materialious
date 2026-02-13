import { JSDOM } from 'jsdom';
import type { IGetChallengeResponse } from 'youtubei.js';
import BG, { buildURL, GOOG_API_KEY, USER_AGENT, type WebPoSignalOutput } from 'bgutils-js';
import { error } from '@sveltejs/kit';
import z from 'zod';

const zPoTokenGenSchema = z.object({
	requestKey: z.string(),
	visitorData: z.string(),
	challenge: z.record(z.any(), z.any())
});

export async function POST({ request }) {
	const data = zPoTokenGenSchema.safeParse(await request.json());

	if (!data.success) {
		throw error(400, data.error.message);
	}

	const challenge = data.data.challenge as IGetChallengeResponse;
	const requestKey = data.data.requestKey;
	const visitorData = data.data.visitorData;

	const youtubeUrl = 'https://www.youtube.com/';

	const dom = new JSDOM(
		'<!DOCTYPE html><html lang="en"><head><title>YouTube</title></head><body></body></html>',
		{
			url: youtubeUrl,
			referrer: youtubeUrl,
			origin: youtubeUrl,
			USER_AGENT
		}
	);

	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		location: dom.window.location,
		origin: dom.window.origin
	});

	if (!Reflect.has(globalThis, 'navigator')) {
		Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
	}

	if (!challenge.bg_challenge) {
		throw error(400, 'BotGuard challenge not provided');
	}

	const interpreterUrl =
		challenge.bg_challenge.interpreter_url
			.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
	const interpreterHash = challenge.bg_challenge.interpreter_hash;

	if (!interpreterUrl || !interpreterHash) {
		throw error(
			500,
			`Could not get integrity token. Interpreter Hash: ${challenge.bg_challenge?.interpreter_hash}`
		);
	}

	const interpreterResponse = await fetch(`https:${interpreterUrl}`, {
		headers: {
			'user-agent': USER_AGENT
		}
	});

	if (!interpreterResponse.ok) {
		throw new Error('Unable to fetch interpreter');
	}

	const interpreterJavascript = await interpreterResponse.text();

	if (interpreterJavascript) {
		new Function(interpreterJavascript)();
	} else throw error(500, 'Could not load VM');

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
		throw error(500, `Could not get integrity token. Interpreter Hash: ${interpreterHash}`);
	}

	const integrityTokenBasedMinter = await BG.WebPoMinter.create(
		{ integrityToken },
		webPoSignalOutput
	);

	return new Response(
		await integrityTokenBasedMinter.mintAsWebsafeString(decodeURIComponent(visitorData)),
		{ status: 200 }
	);
}
