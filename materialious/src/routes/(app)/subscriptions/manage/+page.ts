import { getSubscriptions } from '$lib/api';
import { authProtected } from '$lib/auth';
import { error } from '@sveltejs/kit';

export async function load() {
	authProtected();

	let subscriptions;

	try {
		subscriptions = await getSubscriptions();
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	return {
		subscriptions: subscriptions
	};
}
