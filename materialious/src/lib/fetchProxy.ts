import { isUnrestrictedPlatform, timeout } from '$lib/misc';
import { Capacitor } from '@capacitor/core';
import sodium from 'libsodium-wrappers-sumo';
import { isOwnBackend } from './shared';

export const originalFetch = window.fetch;
const corsProxyUrl =
	Capacitor.getPlatform() === 'android'
		? 'http://localhost:3000/'
		: `${location.origin}/api/proxy/`;

let mobileNodeLoaded = false;

function needsProxying(target: string): boolean {
	if (!target.startsWith('http')) return false;
	return true;
}

function encodeUrl(url: string): string {
	return Capacitor.getPlatform() === 'android' ? url : encodeURIComponent(url);
}

export const fetchProxied = async (
	requestInput: string | URL | Request,
	requestOptions?: RequestInit
): Promise<Response> => {
	if (!mobileNodeLoaded && Capacitor.getPlatform() === 'android') {
		let mobileNodeResp: Response | undefined;

		while (!mobileNodeResp || !mobileNodeResp.ok) {
			try {
				mobileNodeResp = await originalFetch(corsProxyUrl + 'check-nodejs');
			} catch {
				// Continue regardless of error
			}
			await timeout(100);
		}

		mobileNodeLoaded = true;
	}

	const nonProxiedUrl =
		requestInput instanceof Request ? requestInput.url : requestInput.toString();

	if (needsProxying(nonProxiedUrl)) {
		const proxiedUrl = corsProxyUrl + encodeUrl(nonProxiedUrl);

		if (requestInput instanceof Request) {
			requestInput = new Request(proxiedUrl, {
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
			requestInput = proxiedUrl;
		}
	}

	if (isOwnBackend() && Capacitor.getPlatform() === 'web' && requestOptions?.body) {
		if (requestOptions.body instanceof ArrayBuffer) {
			requestOptions.body = new Uint8Array(requestOptions?.body);
		}

		if (requestOptions.body instanceof Uint8Array) {
			await sodium.ready;
			requestOptions.body = sodium.to_base64(requestOptions.body);

			requestOptions.headers = {
				...requestOptions.headers,
				__is_base64_encoded: 'true'
			};
		}
	}

	// Use the original fetch with the proxied URL and options
	return originalFetch(requestInput, requestOptions);
};

if (isUnrestrictedPlatform() && Capacitor.getPlatform() !== 'electron') {
	window.fetch = fetchProxied;

	const originalXhrOpen = XMLHttpRequest.prototype.open;

	XMLHttpRequest.prototype.open = function (...args: any[]): void {
		if (needsProxying(args[1])) {
			args[1] = corsProxyUrl + encodeUrl(args[1]);
		}
		// @ts-expect-error args have any type
		return originalXhrOpen.apply(this, args);
	};
}
