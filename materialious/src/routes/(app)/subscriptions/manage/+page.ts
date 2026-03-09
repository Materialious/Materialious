import { getSubscriptions } from '$lib/api';
import type { Subscription } from '$lib/api/model';
import { authProtected } from '$lib/auth';
import { error } from '@sveltejs/kit';

export async function load() {
	authProtected();

	let subscriptions: Subscription[];

	try {
		subscriptions = await getSubscriptions();
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	subscriptions.sort((a, b) => a.author.localeCompare(b.author));

	return {
		subscriptions: subscriptions
	};
}
