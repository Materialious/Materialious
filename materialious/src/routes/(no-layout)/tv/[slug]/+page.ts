import { getWatchDetails } from '$lib/watch';

export async function load({ params, url }) {
	return await getWatchDetails(params.slug, url);
}
