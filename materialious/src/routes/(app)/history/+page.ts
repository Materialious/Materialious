import { getWatchHistory } from '#lib/api/index';

export async function load() {
	return { videos: await getWatchHistory() };
}
