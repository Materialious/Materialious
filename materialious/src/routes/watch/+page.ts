import { goto } from '$app/navigation';
import { error } from '@sveltejs/kit';

export async function load({ url }) {
	const videoId = url.searchParams.get('v');
	const playlistId = url.searchParams.get('list');
	if (videoId) {
		let goToUrl = `/watch/${videoId}`;

		if (playlistId) {
			goToUrl += `?playlist=${playlistId}`;
		}
		goto(goToUrl);
	} else {
		error(404);
	}
}
