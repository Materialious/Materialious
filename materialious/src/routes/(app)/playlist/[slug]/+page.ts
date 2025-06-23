import { loadEntirePlaylist } from '$lib/playlist.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	let playlist;

	try {
		playlist = await loadEntirePlaylist(params.slug);
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}
	return {
		playlist: playlist
	};
}
