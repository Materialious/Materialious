import { isTvRouteLoading } from '$lib/store';
import { getWatchDetails } from '$lib/watch';

export async function load({ params, url }) {
	isTvRouteLoading.set(true);
	const details = await getWatchDetails(params.slug, url);
	isTvRouteLoading.set(false);
	return details;
}
