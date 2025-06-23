import { getWatchDetails } from '$lib/watch.js';

export async function load({ params, url }) {
	return await getWatchDetails(params.slug, url);
}
