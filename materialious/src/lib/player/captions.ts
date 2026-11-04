import type { Captions, FallbackPatches } from '#lib/api/model';
import { getPublicEnv } from '#lib/env';
import { invidiousInstanceStore } from '#lib/store';
import { get } from 'svelte/store';

/**
 * Candidate URLs for a caption track, best first.
 *
 * Invidious' own `/api/v1/captions` fetches from YouTube directly and is often blocked
 * (an HTML "We're sorry..." page, or an empty VTT), while the instance's companion serves
 * the same captions reliably. The API only ever advertises the former, so the companion
 * path is tried first and the API URL is kept as the fallback.
 */
export function getCaptionUrls(
	caption: Captions,
	fallbackPath: FallbackPatches | undefined = undefined
): string[] {
	const invidiousInstance = get(invidiousInstanceStore);

	if (getPublicEnv('DEFAULT_COMPANION_INSTANCE')) {
		return [`${getPublicEnv('DEFAULT_COMPANION_INSTANCE')}${caption.url}`];
	}

	if (fallbackPath === 'youtubejs') {
		return [caption.url];
	}

	if (!invidiousInstance) {
		return [];
	}

	const origin = new URL(invidiousInstance).origin;
	const apiUrl = caption.url.startsWith('http') ? caption.url : `${origin}${caption.url}`;

	if (caption.url.startsWith('/api/v1/captions/')) {
		return [`${origin}/companion${caption.url}`, apiUrl];
	}

	return [apiUrl];
}

/**
 * Fetches the first candidate that actually has cues. The last candidate is returned
 * as long as the request succeeded, so single-URL behaviour is unchanged.
 */
export async function fetchCaption(urls: string[]): Promise<Response | undefined> {
	for (const [index, url] of urls.entries()) {
		try {
			const resp = await fetch(url, { method: 'GET' });
			if (!resp.ok) continue;

			const isLast = index === urls.length - 1;
			if (isLast || (await resp.clone().text()).includes('-->')) {
				return resp;
			}
		} catch {
			// Try the next candidate.
		}
	}

	return undefined;
}
