import { getFeed } from '$lib/api/index';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	let feed;

	try {
		feed = await getFeed(100, 1);
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}
	return {
		feed: feed
	};
}
