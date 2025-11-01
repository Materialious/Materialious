import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ url }) {
	const playlistId = url.searchParams.get('list');
	if (playlistId) {
		goto(`${base}/playlist/${playlistId}`);
	} else {
		error(404);
	}
}
