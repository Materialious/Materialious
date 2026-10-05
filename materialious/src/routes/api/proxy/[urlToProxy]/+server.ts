import { isOwnBackend } from '$lib/shared';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { Agent, fetch as undiciFetch } from 'undici';
import fs from 'fs';
import tls from 'tls';

import { error } from '@sveltejs/kit';
import { parse as tldParse } from 'tldts';
import { USER_AGENT } from 'bgutils-js/utils';
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
	'returnyoutubedislikeapi.com',
	'ajay.app',
	'googleapis.com'
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
	env.PUBLIC_DEFAULT_COMPANION_INSTANCE
];

const dynamicAllowDomains: string[] = [];

for (const dynamicDomain of dynamicAllowDomainsEnvVars) {
	if (dynamicDomain) {
		dynamicAllowDomains.push(dynamicDomain.replace(/^https?:\/\//, ''));
	}
}

// Node's built-in fetch and its bundled dispatcher must come from the same
// undici copy to interoperate. Since Node 26 (bundled undici 8) the built-in
// fetch expects a v1 compatible dispatcher, so handing it an Agent from the npm
// `undici` package makes every request fail with "TypeError: fetch failed".
//
// Therefore we only build a dispatcher when we actually need one (i.e. a custom
// CA was requested), and when we do we also use undici's own fetch so the
// dispatcher and fetch come from the same copy.
let dispatcher: Agent | undefined;

const certPath = privateEnv.PROXY_TRUST_CA;
if (certPath && fs.existsSync(certPath)) {
	dispatcher = new Agent({
		connect: {
			ca: [fs.readFileSync(certPath), ...tls.rootCertificates]
		}
	});
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

	const requestHeaders = new Headers(request.headers);
	requestHeaders.set('host', urlToProxyObj.host);
	requestHeaders.set('origin', urlToProxyObj.origin);
	requestHeaders.set('user-agent', USER_AGENT);

	// Remove headers that may cause issues or be auto-managed
	for (const key of [
		'referer',
		'x-forwarded-for',
		'x-requested-with',
		'sec-ch-ua-mobile',
		'sec-ch-ua',
		'sec-ch-ua-platform',
		'cookie', // Ensure auth cookies don't become included.
		'content-type',
		'content-length'
	]) {
		requestHeaders.delete(key);
	}

	const requestOptions: RequestInit = {
		method: request.method,
		headers: requestHeaders,
		credentials: 'same-origin',
		...(request.body ? { duplex: 'half' } : {})
	};

	let body: any = request.body;
	if (body) {
		if (request.headers.has('__is_base64_encoded')) {
			requestHeaders.delete('__is_base64_encoded');

			await sodium.ready;
			body = Uint8Array.from(sodium.from_base64(await request.text()));
		} else if (request.method !== 'GET' && request.method !== 'HEAD') {
			body = await request.blob();
		}
	}

	// undici's fetch resolves to undici's own Response class, which is not the
	// global one, so only rely on the parts that actually get read off of it.
	type ProxiedResponse = Pick<Response, 'status' | 'headers' | 'body'>;

	let response: ProxiedResponse | undefined;
	let errorMsg = '';
	try {
		const target = urlToProxyObj.toString();
		const signal = AbortSignal.timeout(10000);

		// Keep fetch paired with the dispatcher it was created by.
		response = dispatcher
			? ((await undiciFetch(target, {
					...requestOptions,
					body,
					signal,
					dispatcher
				})) as unknown as ProxiedResponse)
			: await fetch(target, { ...requestOptions, body, signal });
	} catch (err) {
		const cause = (err as any)?.cause;
		errorMsg = cause?.code
			? `${(err as any).toString()} (${cause.code}: ${cause.message})`
			: (err as any).toString();
		console.warn('Proxy failed with error: ', errorMsg);
	}

	if (!response || errorMsg) {
		throw error(500, errorMsg);
	}

	const responseHeaders = new Headers(response.headers);
	responseHeaders.delete('content-encoding');
	responseHeaders.delete('content-length');

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
