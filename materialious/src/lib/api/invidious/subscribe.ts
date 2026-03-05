import { invidiousAuthStore } from '$lib/store';
import { get } from 'svelte/store';
import { getSubscriptionsInvidious } from './feed';
import { buildAuthHeaders, buildPath, fetchErrorHandle } from './request';

export async function amSubscribedInvidious(
	authorId: string,
	fetchOptions: RequestInit = {}
): Promise<boolean> {
	if (!get(invidiousAuthStore)) return false;

	try {
		const subscriptions = (await getSubscriptionsInvidious(fetchOptions)).filter(
			(sub) => sub.authorId === authorId
		);
		return subscriptions.length === 1;
	} catch {
		return false;
	}
}

export async function postSubscribeInvidious(authorId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'POST',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function deleteUnsubscribeInvidious(authorId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}
