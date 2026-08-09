import { USER_AGENT } from 'bgutils-js/utils';
import { Innertube, Platform, UniversalCache } from 'youtubei.js';
import type { Types } from 'youtubei.js';
import { mintPoTokenInJSDOM } from '../jsdom.js';

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

Platform.shim.eval = async (data: Types.BuildScriptResult) => new Function(data.output)();

export async function getDownloadSession(videoId: string, cacheDir?: string): Promise<Innertube> {
	let poToken: string | undefined;

	try {
		poToken = await mintPoTokenInJSDOM(REQUEST_KEY, videoId);
	} catch (err) {
		console.warn('Failed to mint PO token for download session:', err);
	}

	return await Innertube.create({
		fetch,
		cache: new UniversalCache(true, cacheDir),
		user_agent: USER_AGENT,
		...(poToken ? { po_token: poToken } : {})
	});
}
