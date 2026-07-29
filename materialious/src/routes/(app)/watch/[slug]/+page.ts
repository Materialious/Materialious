import { getWatchPage, getWatchPlayer } from '$lib/watch';

export function load({ params, url }) {
	const videoId = params.slug;

	return {
		streamed: {
			page: getWatchPage(videoId, url),
			player: getWatchPlayer(videoId, url)
		}
	};
}
