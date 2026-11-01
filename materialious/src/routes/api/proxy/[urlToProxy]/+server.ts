import { BASE64_BODY_HEADER, isOwnBackend } from '$lib/shared';
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';
import { Agent } from 'undici';
import fs from 'fs';
import tls from 'tls';

import { error } from '@sveltejs/kit';
import { parse as tldParse } from 'tldts';
import { USER_AGENT } from 'bgutils-js/utils';
import sodium from 'libsodium-wrappers-sumo';

/**
 * The cookies of a signed-in youtube.com session, sent under a name of their
 * own because a browser will not let a page send a Cookie header.
 */
const YOUTUBE_COOKIE_HEADER = 'x-materialious-youtube-cookie';

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
	'Cookie',
	BASE64_BODY_HEADER,
	YOUTUBE_COOKIE_HEADER
].join(', ');

function isYouTubeHost(host: string): boolean {
	const name = host.toLowerCase().replace(/:\d+$/, '');
	return name === 'youtube.com' || name.endsWith('.youtube.com');
}

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

/**
 * A path that is not going to answer should be given up on while there is still
 * time to ask again, rather than spending the whole budget finding out. Four
 * seconds is far longer than a reachable host needs.
 */
const CONNECT_TIMEOUT_MS = 4_000;

/** Upstream answers in well under a second when it is answering at all. */
const HEADERS_TIMEOUT_MS = 8_000;

/**
 * Media segments keep arriving long after their headers did, so this is an
 * allowance for silence rather than for the size of the thing being sent.
 */
const BODY_TIMEOUT_MS = 60_000;

/**
 * A reply that keeps trickling resets the allowance above on every chunk, so
 * this is the backstop against one that trickles indefinitely and holds a
 * connection open for as long as it cares to. Far beyond any real segment.
 */
const OVERALL_TIMEOUT_MS = 300_000;

let dispatcher: Agent;

const certPath = privateEnv.PROXY_TRUST_CA;
const agentOptions = {
	// Reaching the host, and hearing the first of its answer, are the parts
	// worth putting a clock on. Timing the whole exchange instead cuts off long
	// replies that were arriving perfectly well.
	connectTimeout: CONNECT_TIMEOUT_MS,
	headersTimeout: HEADERS_TIMEOUT_MS,
	bodyTimeout: BODY_TIMEOUT_MS
};

if (certPath && fs.existsSync(certPath)) {
	dispatcher = new Agent({
		...agentOptions,
		connect: { ca: [fs.readFileSync(certPath), ...tls.rootCertificates] }
	});
} else {
	dispatcher = new Agent(agentOptions);
}

/** Undici reports the reason for a failed fetch as the cause of a plain error. */
function failureCode(err: unknown): string {
	let cause: unknown = err;

	for (let depth = 0; depth < 4 && cause; depth++) {
		const code = (cause as { code?: unknown }).code;
		if (typeof code === 'string') return code;
		cause = (cause as { cause?: unknown }).cause;
	}

	return (err as { name?: string })?.name ?? 'Error';
}

/**
 * Failures from before the request reached upstream at all. Nothing was
 * delivered, so a second attempt repeats nothing, whatever it was asking for.
 */
const RETRYABLE_BEFORE_SEND = new Set([
	'UND_ERR_CONNECT_TIMEOUT',
	'ECONNREFUSED',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
	// A name that would not resolve this once - seen for video servers that
	// resolved a moment later.
	'ENOTFOUND'
]);

/**
 * Failures from after it was written to the socket. Losing the connection
 * before the reply arrives says nothing about whether upstream carried the
 * request out, so these may only be repeated for methods that ask upstream to
 * do nothing - retrying a subscribe here would subscribe twice.
 */
const RETRYABLE_AFTER_SEND = new Set([
	'UND_ERR_HEADERS_TIMEOUT',
	'UND_ERR_SOCKET',
	'ECONNRESET',
	'ETIMEDOUT'
]);

/**
 * A request for video that is a POST only because of how it is asked.
 *
 * YouTube's streaming protocol sends what it wants in a body, so every piece of
 * a video is fetched with a POST - but it asks for media and changes nothing,
 * and asking twice gets the same piece twice. Treating it like any other POST
 * meant one dropped connection to a video server ended the video: the player
 * got a 500 and stopped, with "Shaka Error 1002".
 */
function asksForMediaOnly(url: URL, method: string): boolean {
	return (
		method === 'POST' &&
		url.hostname.endsWith('.googlevideo.com') &&
		url.pathname === '/videoplayback'
	);
}

function canRetry(code: string, method: string, url: URL): boolean {
	if (RETRYABLE_BEFORE_SEND.has(code)) return true;

	const changesNothing = method === 'GET' || method === 'HEAD' || asksForMediaOnly(url, method);

	return changesNothing && RETRYABLE_AFTER_SEND.has(code);
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

	// Taken off every request, whatever it is for, and only put back as a
	// cookie for YouTube itself. A signed-in Google session is not something to
	// hand to a video server, an image host, or anything else on the list.
	const youtubeCookie = requestHeaders.get(YOUTUBE_COOKIE_HEADER);
	requestHeaders.delete(YOUTUBE_COOKIE_HEADER);
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

	if (youtubeCookie && isYouTubeHost(urlToProxyObj.host)) {
		requestHeaders.set('cookie', youtubeCookie);
	}

	const requestOptions: RequestInit = {
		method: request.method,
		headers: requestHeaders,
		credentials: 'same-origin',
		...(request.body ? { duplex: 'half' } : {})
	};

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	const isBase64Body = hasBody && request.headers.has(BASE64_BODY_HEADER);

	requestHeaders.delete(BASE64_BODY_HEADER);

	let body: any = request.body;
	if (body) {
		if (isBase64Body) {
			await sodium.ready;
			try {
				body = sodium.from_base64(await request.text());
			} catch {
				throw error(400, 'Malformed base64 request body');
			}
		} else if (hasBody) {
			body = await request.blob();
		}
	}

	// Upstream occasionally hangs rather than being slow: a call that usually
	// answers in well under a second sits there until the timeout, and the page
	// waiting on it has nothing to show for the wait. A second attempt opens a
	// fresh connection and normally answers at once. The body is held in memory
	// by this point and can be sent twice.
	const attempts = 2;

	// Which call it was is the first thing anyone reading the log wants, and the
	// query carries signatures and tokens, so it is left out.
	const target = `${request.method} ${urlToProxyObj.host}${urlToProxyObj.pathname}`;

	let response: Response | undefined;
	let errorMsg = '';

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			response = await fetch(urlToProxyObj.toString(), {
				...requestOptions,
				body,
				// A caller that has gone away should not leave its request running
				// on upstream, and nothing should run forever.
				signal: AbortSignal.any([request.signal, AbortSignal.timeout(OVERALL_TIMEOUT_MS)]),
				// @ts-expect-error Node-specific option
				dispatcher
			});
			errorMsg = '';
			break;
		} catch (err) {
			const code = failureCode(err);
			errorMsg = (err as any).toString();

			if (canRetry(code, request.method, urlToProxyObj) && attempt < attempts) {
				console.warn(`Proxy ${code}, asking once more: ${target}`);
				continue;
			}

			console.warn(`Proxy failed (${code}): ${target}`);
			break;
		}
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
