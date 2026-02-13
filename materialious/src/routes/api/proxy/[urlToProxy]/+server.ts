import { isOwnBackend } from '$lib/shared';
import psl from 'psl';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { verifyCaptcha } from '$lib/server/captcha.js';

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
	env.VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE,
	env.VITE_DEFAULT_DEARROW_INSTANCE,
	env.VITE_DEFAULT_INVIDIOUS_INSTANCE,
	env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE,
	env.VITE_DEFAULT_API_EXTENDED_INSTANCE,
	env.VITE_DEFAULT_SYNCIOUS_INSTANCE
];

dynamicAllowDomains.forEach((domain) => {
	if (domain) {
		allowedDomains.push(domain);
	}
});

async function proxyRequest(
	request: Request,
	urlToProxy: string,
	captchaKey: string,
	userId: string | undefined = undefined
): Promise<Response> {
	const backendRestrictions = isOwnBackend();
	if (!backendRestrictions) {
		// Shouldn't be possible.
		throw error(400, 'How did you get here?');
	}

	if (backendRestrictions.requireAuth && !userId) {
		throw error(401, 'Auth required');
	}

	let urlToProxyObj: URL;
	try {
		urlToProxyObj = new URL(decodeURIComponent(urlToProxy));
	} catch {
		throw error(400, 'Invalid URL');
	}

	if (!allowedDomains.includes(psl.parse(urlToProxyObj.host).domain)) {
		// allowAnyProxy allows a instance owner to bypass the whitelist.
		// BUT is extremely strict.
		// AND I still don't recommend this.
		if (
			!backendRestrictions.allowAnyProxy ||
			!backendRestrictions.requireAuth ||
			backendRestrictions.registrationAllowed ||
			!userId
		) {
			throw error(400, 'Invalid URL');
		}
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

export async function GET({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.captchaKey, locals.userId);
}
export async function PATCH({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.captchaKey, locals.userId);
}

export async function DELETE({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.captchaKey, locals.userId);
}

export async function PUT({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.captchaKey, locals.userId);
}

export async function POST({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.captchaKey, locals.userId);
}
