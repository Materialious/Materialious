import { getChannel } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	let channel;

	try {
		channel = await getChannel(params.slug);
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	return {
		channel: channel
	};
}
