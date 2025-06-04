import { getSearch } from '$lib/api/index';
import { searchCacheStore } from '$lib/store.js';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load({ params, url }) {
	let type: 'playlist' | 'all' | 'video' | 'channel';

	const queryFlag = url.searchParams.get('type');
	if (queryFlag && ['playlist', 'video', 'channel', 'all'].includes(queryFlag)) {
		type = queryFlag as 'playlist' | 'all' | 'video' | 'channel';
	} else {
		type = 'all';
	}

	const searchStoreId = type + params.slug;
	const search = get(searchCacheStore)[searchStoreId];

	if (!search) {
		try {
			searchCacheStore.set({ [searchStoreId]: await getSearch(params.slug, { type: type }) });
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}
	} else {
		getSearch(params.slug, { type: type }).then((newSearch) => {
			searchCacheStore.set({
				[searchStoreId]: [...new Set([...newSearch, ...search])]
			});
		});
	}

	return {
		slug: params.slug,
		searchType: type,
		searchStoreId: searchStoreId
	};
}
