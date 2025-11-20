import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ url }) {
	const videoId = url.searchParams.get('v');
	const playlistId = url.searchParams.get('list');
	const timestamp = url.searchParams.get('t');

	if (videoId) {
		const goToUrl = new URL(`${location.origin}${resolve(`/watch/[videoId]`, { videoId })}`);

		if (playlistId) {
			goToUrl.searchParams.set('playlist', playlistId);
		}

		if (timestamp) {
			goToUrl.searchParams.set('time', timestamp);
		}

		goto(goToUrl);
	} else {
		error(404);
	}
}
