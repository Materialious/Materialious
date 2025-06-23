import { getWatchDetails } from '$lib/watch.js';

export async function load({ params, url }) {
	return getWatchDetails(params.slug, url);
}
