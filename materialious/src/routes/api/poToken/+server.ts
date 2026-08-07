import { JSDOM } from 'jsdom';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { fetchInnerTubeChallenge, mintPoToken } from '$lib/youtube/poToken';
import { isOwnBackend } from '$lib/shared/index';

const zPoTokenGenSchema = z.object({
	requestKey: z.string(),
	visitorData: z.string()
});

export async function POST({ request, locals }) {
	if (isOwnBackend()?.requireAuth && !locals.userId) {
		throw error(401);
	}

	const data = zPoTokenGenSchema.safeParse(await request.json());

	if (!data.success) {
		throw error(400, data.error.message);
	}

	const { requestKey, visitorData } = data.data;

	try {
		const dom = new JSDOM(
			'<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
			{
				url: 'https://www.youtube.com/',
				referrer: 'https://www.youtube.com/'
			}
		);

		const { ytConfig, challengeResponse, interpreterJavascript } = await fetchInnerTubeChallenge();

		dom.window.yt = { config_: JSON.parse(ytConfig) };

		Object.assign(globalThis, {
			yt: dom.window.yt,
			window: dom.window,
			document: dom.window.document,
			location: dom.window.location,
			origin: dom.window.origin
		});

		if (!Reflect.has(globalThis, 'navigator')) {
			Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
		}

		new Function(interpreterJavascript)();

		return new Response(await mintPoToken(requestKey, visitorData, challengeResponse), {
			status: 200
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to generate PO token');
	}
}
