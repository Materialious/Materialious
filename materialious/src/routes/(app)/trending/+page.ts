import { getTrending } from '$lib/api/index';
import { feedCacheStore } from '$lib/store';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load() {
	let trending = get(feedCacheStore).trending;

	if (!trending) {
		try {
			trending = await getTrending();
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}

		feedCacheStore.set({ trending });
	} else {
		getTrending().then((newTrending) => feedCacheStore.set({ trending: newTrending }));
	}
}
