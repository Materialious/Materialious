import { getPopular } from '$lib/api/index';
import { feedCacheStore } from '$lib/store';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load() {
	let popular = get(feedCacheStore).popular;
	let popularDisabled: boolean = false;

	if (!popular) {
		try {
			popular = await getPopular();
		} catch (errorMessage: any) {
			if (errorMessage.toString() === 'Error: Administrator has disabled this endpoint.') {
				popularDisabled = true;
			} else {
				error(500, errorMessage);
			}
		}

		feedCacheStore.set({ ...get(feedCacheStore), popular });
	} else {
		getPopular().then((newPopular) =>
			feedCacheStore.set({ ...get(feedCacheStore), popular: newPopular })
		);
	}

	return {
		popularDisabled: popularDisabled
	};
}
