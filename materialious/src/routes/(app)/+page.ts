import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getPopular, HTTPError } from '$lib/api/index';
import { isYTBackend } from '$lib/misc';
import { feedCacheStore, invidiousInstanceStore } from '$lib/store';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load() {
	if (isYTBackend()) {
		goto(resolve('/subscriptions', {}), { replaceState: true });
		return;
	}

	if (!get(invidiousInstanceStore)) {
		return {
			popularDisabled: true
		};
	}

	let popular = get(feedCacheStore).popular;
	let popularDisabled: boolean = false;

	if (!popular) {
		let errorObj: HTTPError | undefined;
		try {
			popular = await getPopular();
		} catch (popularError) {
			if (popularError instanceof HTTPError) errorObj = popularError;
		}

		if (errorObj) {
			if (errorObj.response.status === 403) {
				popularDisabled = true;
			} else {
				throw error(500, errorObj.toString());
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
