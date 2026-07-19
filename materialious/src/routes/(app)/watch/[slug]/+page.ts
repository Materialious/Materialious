import { getWatchDetails } from '$lib/watch';

export function load({ params, url }) {
	return {
		streamed: {
			details: getWatchDetails(params.slug, url)
		}
	};
}
