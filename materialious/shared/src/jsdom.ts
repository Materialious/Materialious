import { JSDOM } from 'jsdom';

import { fetchInnerTubeChallenge, mintPoToken } from './poToken.js';

export async function mintPoTokenInJSDOM(requestKey: string, visitorData: string): Promise<string> {
	const youtubeUrl = 'https://www.youtube.com/';

	const dom = new JSDOM(
		'<!DOCTYPE html><html lang="en"><head><title>YouTube</title></head><body></body></html>',
		{
			url: youtubeUrl,
			referrer: youtubeUrl
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

	const { ytConfig, challengeResponse, interpreterJavascript } = await fetchInnerTubeChallenge();

	dom.window.yt = { config_: JSON.parse(ytConfig) };
	Object.assign(globalThis, { yt: dom.window.yt });

	new Function(interpreterJavascript)();

	return await mintPoToken(requestKey, visitorData, challengeResponse);
}
