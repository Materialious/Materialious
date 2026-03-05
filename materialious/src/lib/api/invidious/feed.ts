import type { Feed, Subscription, Video } from '../model';
import { buildAuthHeaders, buildPath, fetchErrorHandle } from './request';

export async function getPopularInvidious(fetchOptions?: RequestInit): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(buildPath('popular'), fetchOptions));
	return await resp.json();
}

export async function getFeedInvidious(
	maxResults: number,
	page: number,
	fetchOptions: RequestInit = {}
): Promise<Feed> {
	const path = buildPath('auth/feed');
	path.searchParams.set('max_results', maxResults.toString());
	path.searchParams.set('page', page.toString());
	const resp = await fetchErrorHandle(
		await fetch(path, { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function getSubscriptionsInvidious(
	fetchOptions: RequestInit = {}
): Promise<Subscription[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/subscriptions'), { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}
