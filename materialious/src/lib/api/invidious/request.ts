import { Capacitor } from '@capacitor/core';
import { getUserLocale } from '#lib/i18n/index';
import { normalizeContentRegion } from '#lib/regions';
import {
	interfacePreserveTranslation,
	interfaceRegionStore,
	invidiousAuthStore,
	invidiousInstanceStore
} from '#lib/store';
import { get } from 'svelte/store';

export function buildPath(path: string): URL {
	return setLocale(new URL(`${get(invidiousInstanceStore)}/api/v1/${path}`));
}

export function setLocale(url: URL): URL {
	const region = normalizeContentRegion(get(interfaceRegionStore));
	if (region) {
		url.searchParams.set('region', region);
	}

	if (!get(interfacePreserveTranslation)) {
		const locale = getUserLocale();
		url.searchParams.set('hl', locale);
	}

	return url;
}

export class HTTPError {
	msg: string;
	response: Response;
	apiError?: string;

	constructor(msg: string, response: Response, apiError?: string) {
		this.msg = msg;
		this.response = response;
		this.apiError = apiError;
	}

	toString() {
		return this.msg;
	}
}

export async function fetchErrorHandle(response: Response): Promise<Response> {
	if (!response.ok) {
		let message = 'Internal error';
		let apiError: string | undefined;

		// Attempt to parse error.
		try {
			const json = await response.json();
			if (typeof json.error === 'string') apiError = json.error;
			message = json.errorBacktrace || json.error || json.message;
		} catch {
			// Continue regardless of error
		}

		throw new HTTPError(
			`${response.status} - ${response.statusText}\n${decodeURIComponent(response.url)}\n${message}`,
			response,
			apiError
		);
	}

	return response;
}

export function buildAuthHeaders(): { headers: Record<string, string> } {
	const auth = get(invidiousAuthStore);
	if (auth?.instance && auth.instance !== get(invidiousInstanceStore)?.replace(/\/$/, '')) {
		return { headers: {} };
	}
	const authToken = auth?.token ?? '';
	if (authToken.startsWith('SID=')) {
		// Browser fetch cannot set Cookie; the platform transport translates this header.
		const header = Capacitor.getPlatform() === 'android' ? '__sid_auth' : 'X-Invidious-SID';
		return { headers: { [header]: authToken } };
	} else {
		return { headers: { Authorization: `Bearer ${authToken}` } };
	}
}
