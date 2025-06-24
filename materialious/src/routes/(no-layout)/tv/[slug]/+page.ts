import { isTvRouteLoading } from '$lib/store.js';
import { getWatchDetails } from '$lib/watch.js';

export async function load({ params, url }) {
	isTvRouteLoading.set(true);
	const details = await getWatchDetails(params.slug, url);
	isTvRouteLoading.set(false);
	return details;
}
