import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { getPopular } from '$lib/api/index';
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
		let errorMsg: Error | undefined;
		try {
			popular = await getPopular();
		} catch (popularError) {
			errorMsg = popularError as Error;
		}

		if (errorMsg) {
			if (errorMsg.toString() === 'Error: Administrator has disabled this endpoint.') {
				popularDisabled = true;
			} else {
				throw error(500, errorMsg);
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
