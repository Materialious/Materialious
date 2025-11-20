import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { error } from '@sveltejs/kit';

export async function load({ url }) {
	const playlistId = url.searchParams.get('list');
	if (playlistId) {
		goto(resolve(`/playlist/[playlistId]`, { playlistId }));
	} else {
		error(404);
	}
}
