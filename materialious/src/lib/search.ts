import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { get } from 'svelte/store';
import { isVideoID } from './misc';
import { interfaceSearchHistoryEnabled, searchHistoryStore } from './store';

export function goToSearch(searchValue: string) {
	const searchTrimed = searchValue.trim();

	if (!searchTrimed) return;

	if (isVideoID(searchTrimed)) {
		// Go directly to video if Video ID provided
		goto(resolve('/watch/[videoId]', { videoId: searchTrimed }));
		return;
	}

	goto(resolve(`/search/[search]`, { search: encodeURIComponent(searchTrimed) }));

	if (get(interfaceSearchHistoryEnabled) && !get(searchHistoryStore).includes(searchTrimed)) {
		const pastHistory = get(searchHistoryStore);
		if (pastHistory.length > 15) {
			pastHistory.pop();
		}
		searchHistoryStore.set([searchTrimed, ...pastHistory]);
	}
}
