import { timeout } from '$lib/misc';
import { Capacitor } from '@capacitor/core';

const originalFetch = window.fetch;
const corsProxyUrl: string = 'http://localhost:3000/';

let nodejsStarted = false;

function needsProxying(target: string): boolean {
	if (!target.startsWith('http')) return false;
	return true;
}

export const androidFetch = async (
	requestInput: string | URL | Request,
	requestOptions?: RequestInit
): Promise<Response> => {
	// On initial request pause until OPTIONS request passes on local proxy, only reliable way
	// to ensure proxy is working on android.
	if (!nodejsStarted) {
		let testResp: Response | undefined = undefined;
		while (typeof testResp === 'undefined' || !testResp.ok) {
			try {
				testResp = await originalFetch(corsProxyUrl, { method: 'OPTIONS' });
			} catch (error) {}
			await timeout(100);
		}
		nodejsStarted = true;
	}

	const uri = requestInput instanceof Request ? requestInput.url : requestInput.toString();

	if (needsProxying(uri)) {
		if (requestInput instanceof Request) {
			requestInput = new Request(corsProxyUrl + uri, {
				method: requestInput.method,
				headers: requestInput.headers,
				body: requestInput.body,
				mode: requestInput.mode,
				credentials: requestInput.credentials,
				cache: requestInput.cache,
				redirect: requestInput.redirect,
				referrer: requestInput.referrer,
				integrity: requestInput.integrity,
				keepalive: requestInput.keepalive,
				...(requestInput.body ? { duplex: 'half' } : {})
			});
		} else {
			requestInput = corsProxyUrl + uri;
		}
	}

	// Use the original fetch with the proxied URL and options
	return originalFetch(requestInput, requestOptions);
};

if (Capacitor.getPlatform() === 'android') {
	window.fetch = androidFetch;

	const originalXhrOpen = XMLHttpRequest.prototype.open;

	XMLHttpRequest.prototype.open = function (...args: any[]): void {
		if (needsProxying(args[1])) {
			args[1] = corsProxyUrl + args[1];
		}
		/* @ts-ignore */
		return originalXhrOpen.apply(this, args);
	};
}
