import { isOwnBackend } from '$lib/backend';
import psl from 'psl';

const allowedDomains: string[] = [
	'youtube.com',
	'ytimg.com',
	'googlevideo.com',
	'returnyoutubedislike.com',
	'sponsor.ajay.app',
	'dearrow-thumb.ajay.app',
	'materialio.us'
];

const dynamicAllowDomains = [
	process.env.VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE,
	process.env.VITE_DEFAULT_DEARROW_INSTANCE,
	process.env.VITE_DEFAULT_INVIDIOUS_INSTANCE,
	process.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE,
	process.env.VITE_DEFAULT_API_EXTENDED_INSTANCE,
	process.env.VITE_DEFAULT_SYNCIOUS_INSTANCE
];

dynamicAllowDomains.forEach((domain) => {
	if (domain) {
		allowedDomains.push(domain);
	}
});

async function proxyRequest(request: Request, urlToProxy: string): Promise<Response> {
	const backendRestrictions = isOwnBackend();
	if (!backendRestrictions) {
		// Shouldn't be possible.
		return new Response('How did you get here?', { status: 400 });
	}

	if (backendRestrictions.requireAuth) {
		return new Response('Auth required', { status: 401 });
	}

	let urlToProxyObj: URL;
	try {
		urlToProxyObj = new URL(decodeURIComponent(urlToProxy));
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	if (!allowedDomains.includes(psl.parse(urlToProxyObj.host).domain)) {
		return new Response('Invalid URL', { status: 400 });
	}

	if (urlToProxyObj.pathname.includes('v1/player')) {
		urlToProxyObj.searchParams.set(
			'$fields',
			'playerConfig,captions,playabilityStatus,streamingData,responseContext.mainAppWebResponseContext.datasyncId,videoDetails.isLive,videoDetails.isLiveContent,videoDetails.title,videoDetails.author,playbackTracking'
		);
	}

	const requestHeaders = request.headers;
	requestHeaders.set('host', urlToProxyObj.host);
	requestHeaders.set('origin', urlToProxyObj.origin);

	for (const key of [
		'referer',
		'x-forwarded-for',
		'x-requested-with',
		'sec-ch-ua-mobile',
		'sec-ch-ua',
		'sec-ch-ua-platform'
	]) {
		requestHeaders.delete(key);
	}

	const fetchRes = await fetch(urlToProxy.toString(), {
		method: request.method,
		headers: requestHeaders,
		body: request.body,
		credentials: 'same-origin',
		...(request.body ? { duplex: 'half' } : {})
	});

	return new Response(fetchRes.body, {
		status: fetchRes.status
	});
}

export async function GET({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}
export async function PATCH({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}

export async function DELETE({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}

export async function PUT({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}

export async function POST({ request, params }) {
	return await proxyRequest(request, params.urlToProxy);
}
