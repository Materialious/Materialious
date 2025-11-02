import { getWatchDetails } from '$lib/watch';

export async function load({ params, url }) {
	return getWatchDetails(params.slug, url);
}
