import type { Captions, FallbackPatches } from '$lib/api/model';
import { getPublicEnv } from '$lib/misc';
import { invidiousInstanceStore } from '$lib/store';
import { get } from 'svelte/store';

export function getCaptionUrl(
	caption: Captions,
	fallbackPath: FallbackPatches | undefined = undefined
) {
	let captionUrl: string | undefined;

	const invidiousInstance = get(invidiousInstanceStore);

	if (getPublicEnv('DEFAULT_COMPANION_INSTANCE')) {
		captionUrl = `${getPublicEnv('DEFAULT_COMPANION_INSTANCE')}${caption.url}`;
	} else if (fallbackPath === 'youtubejs') {
		captionUrl = caption.url;
	} else if (invidiousInstance) {
		captionUrl = caption.url.startsWith('http')
			? caption.url
			: `${new URL(invidiousInstance).origin}${caption.url}`;
	}

	return captionUrl;
}
