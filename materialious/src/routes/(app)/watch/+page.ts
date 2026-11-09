import { resolve } from '$app/paths';
import { error } from '@sveltejs/kit';

import { redirect } from '@sveltejs/kit';

export async function load({ url }) {
	const rawVideoId = url.searchParams.get('v');
	const [videoId, embeddedQuery] = (rawVideoId ?? '').split('?', 2);
	const playlistId = url.searchParams.get('list');
	const timestamp =
		url.searchParams.get('t') ??
		url.searchParams.get('time') ??
		new URLSearchParams(embeddedQuery).get('t');

	if (videoId) {
		const goToUrl = new URL(`${url.origin}${resolve('/(app)/watch/[slug]', { slug: videoId })}`);

		if (playlistId) {
			goToUrl.searchParams.set('playlist', playlistId);
		}

		if (timestamp) {
			goToUrl.searchParams.set('time', timestamp);
		}

		throw redirect(302, goToUrl);
	} else {
		error(404);
	}
}
