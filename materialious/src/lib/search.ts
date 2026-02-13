import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { get } from 'svelte/store';
import { interfaceSearchHistoryEnabled, searchHistoryStore } from './store';
import { isVideoID } from './misc';

function extractVideoId(url: string): string | null {
	const urlObj = new URL(url, 'http://example.com'); // Using a base URL in case searchValue is just a query parameter

	let videoId: string | null = null;
	if (urlObj.hostname === 'youtu.be') {
		videoId = urlObj.pathname.replace('/', '');
		if (videoId === '') {
			videoId = null;
		}
	} else {
		videoId = urlObj.searchParams.get('v');
	}

	return videoId;
}

export function goToSearch(searchValue: string) {
	const searchTrimmed = searchValue.trim();

	if (!searchTrimmed) return;

	const videoIdFromUrl = extractVideoId(searchTrimmed);
	if (videoIdFromUrl && isVideoID(videoIdFromUrl)) {
		goto(resolve('/watch/[videoId]', { videoId: videoIdFromUrl }));
		return;
	}

	goto(resolve(`/search/[search]`, { search: encodeURIComponent(searchTrimmed) }));

	if (get(interfaceSearchHistoryEnabled)) {
		const pastHistory = get(searchHistoryStore);

		const index = pastHistory.indexOf(searchTrimmed);
		if (index !== -1) {
			pastHistory.splice(index, 1);
		}

		if (pastHistory.length >= 15) {
			pastHistory.pop();
		}

		searchHistoryStore.set([searchTrimmed, ...pastHistory]);
	}
}
