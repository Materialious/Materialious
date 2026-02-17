import { isOwnBackend } from '$lib/shared';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

import { error } from '@sveltejs/kit';
import { parse as tldParse } from 'tldts';
import { USER_AGENT } from 'bgutils-js';
import sodium from 'libsodium-wrappers-sumo';

const ALLOWED_HEADERS = [
	'Origin',
	'X-Requested-With',
	'Content-Type',
	'Accept',
	'Authorization',
	'x-goog-visitor-id',
	'x-goog-api-key',
	'x-origin',
	'x-youtube-client-version',
	'x-youtube-client-name',
	'x-goog-api-format-version',
	'x-goog-authuser',
	'x-user-agent',
	'Accept-Language',
	'X-Goog-FieldMask',
	'Range',
	'Referer',
	'Cookie'
].join(', ');

const allowedBaseDomains: string[] = [
	'youtube.com',
	'ytimg.com',
	'googlevideo.com',
	'returnyoutubedislike.com',
	'ajay.app'
];

if (privateEnv.WHITELIST_BASE_DOMAIN) {
	for (const baseDomain of privateEnv.WHITELIST_BASE_DOMAIN.split(',')) {
		if (baseDomain) allowedBaseDomains.push(baseDomain);
	}
}

const dynamicAllowDomainsEnvVars = [
	env.PUBLIC_DEFAULT_DEARROW_THUMBNAIL_INSTANCE,
	env.PUBLIC_DEFAULT_DEARROW_INSTANCE,
	env.PUBLIC_DEFAULT_INVIDIOUS_INSTANCE,
	env.PUBLIC_DEFAULT_RETURNYTDISLIKES_INSTANCE,
	env.PUBLIC_DEFAULT_API_EXTENDED_INSTANCE,
	env.PUBLIC_DEFAULT_SYNCIOUS_INSTANCE,
	env.PUBLIC_DEFAULT_COMPANION_INSTANCE
];

const dynamicAllowDomains: string[] = [];

for (const dynamicDomain of dynamicAllowDomainsEnvVars) {
	if (dynamicDomain) {
		dynamicAllowDomains.push(dynamicDomain.replace(/^https?:\/\//, ''));
	}
}

async function proxyRequest(
	request: Request,
	urlToProxy: string,
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

	const baseDomain = tldParse(urlToProxyObj.host).domain;

	if (
		!dynamicAllowDomains.includes(urlToProxyObj.host) &&
		(!baseDomain || !allowedBaseDomains.includes(baseDomain))
	) {
		// allowAnyProxy allows a instance owner to bypass the whitelist.
		// BUT is extremely strict.
		// AND I still don't recommend this.
		if (
			!backendRestrictions.allowAnyProxy ||
			!backendRestrictions.requireAuth ||
			backendRestrictions.registrationAllowed ||
			!userId
		) {
			throw error(400, 'URL not whitelisted');
		}
	}

	const requestHeaders = new Headers();
	requestHeaders.set('host', urlToProxyObj.host);
	requestHeaders.set('origin', urlToProxyObj.origin);
	requestHeaders.set('user-agent', USER_AGENT);

	const authHeader = request.headers.get('Authorization');
	if (authHeader) {
		requestHeaders.set('Authorization', authHeader);
	}

	const requestOptions: RequestInit = {
		method: request.method,
		headers: requestHeaders,
		credentials: 'same-origin',
		...(request.body ? { duplex: 'half' } : {})
	};

	let body;
	if (request.body && request.headers.has('__is_base64_encoded')) {
		request.headers.delete('__is_base64_encoded');

		await sodium.ready;
		body = Uint8Array.from(sodium.from_base64(await request.text()));
	} else {
		body = request.body;
	}

	let response: Response | undefined;
	let errorMsg = '';
	try {
		response = await fetch(urlToProxyObj.toString(), {
			...requestOptions,
			body,
			signal: AbortSignal.timeout(10000)
		});
	} catch (err) {
		errorMsg = (err as any).toString();
		console.warn('Proxy failed with error: ', errorMsg);
	}

	if (!response || errorMsg) {
		throw error(500, errorMsg);
	}

	const responseHeaders = new Headers(response.headers);
	responseHeaders.set('transfer-encoding', 'chunked');
	responseHeaders.delete('content-encoding');
	responseHeaders.delete('access-control-allow-origin');
	responseHeaders.delete('timing-allow-origin');

	return new Response(response.body, {
		status: response.status,
		headers: responseHeaders
	});
}

export async function GET({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.userId);
}
export async function PATCH({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.userId);
}

export async function DELETE({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.userId);
}

export async function PUT({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.userId);
}

export async function POST({ request, params, locals }) {
	return await proxyRequest(request, params.urlToProxy, locals.userId);
}

export async function OPTIONS({ request }) {
	return new Response('', {
		status: 200,
		headers: new Headers({
			'Access-Control-Allow-Origin': request.headers.get('origin') || '',
			'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, OPTIONS',
			'Access-Control-Allow-Headers': ALLOWED_HEADERS,
			'Access-Control-Max-Age': '86400',
			'Access-Control-Allow-Credentials': 'true'
		})
	});
}
