import { getWatchHistory } from '$lib/api';

export async function load() {
	return { videos: await getWatchHistory() };
}
