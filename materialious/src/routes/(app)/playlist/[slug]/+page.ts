import { loadEntirePlaylist } from '$lib/playlist';

export function load({ params }) {
	return {
		streamed: {
			details: loadEntirePlaylist(params.slug)
		}
	};
}
