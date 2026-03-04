import { getUserLocale } from '$lib/i18n';
import { interfaceRegionStore, invidiousAuthStore, invidiousInstanceStore } from '$lib/store';
import { get } from 'svelte/store';

export function buildPath(path: string): URL {
	return setLocale(new URL(`${get(invidiousInstanceStore)}/api/v1/${path}`));
}

export function setLocale(url: URL): URL {
	const region = get(interfaceRegionStore);

	if (region) {
		url.searchParams.set('region', region);
	}

	const locale = getUserLocale();

	url.searchParams.set('hl', locale);

	return url;
}

export class HTTPError {
	msg: string;
	response: Response;

	constructor(msg: string, response: Response) {
		this.msg = msg;
		this.response = response;
	}

	toString() {
		return this.msg;
	}
}

export async function fetchErrorHandle(response: Response): Promise<Response> {
	if (!response.ok) {
		let message = 'Internal error';

		// Attempt to parse error.
		try {
			const json = await response.json();
			message = json.errorBacktrace || json.error || json.message;
		} catch {
			// Continue regardless of error
		}

		throw new HTTPError(
			`${response.status} - ${response.statusText}\n${decodeURIComponent(response.url)}\n${message}`,
			response
		);
	}

	return response;
}

export function buildAuthHeaders(): { headers: Record<string, string> } {
	const authToken = get(invidiousAuthStore)?.token ?? '';
	if (authToken.startsWith('SID=')) {
		return { headers: { __sid_auth: authToken } };
	} else {
		return { headers: { Authorization: `Bearer ${authToken}` } };
	}
}
