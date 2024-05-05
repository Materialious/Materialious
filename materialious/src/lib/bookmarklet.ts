import { page } from '$app/stores';
import { get } from 'svelte/store';
import {
	darkModeStore,
	deArrowEnabledStore,
	deArrowInstanceStore,
	deArrowThumbnailInstanceStore,
	interfacePreviewVideoOnHoverStore,
	interfaceSearchSuggestionsStore,
	playerAlwaysLoopStore,
	playerAutoPlayStore,
	playerAutoplayNextByDefaultStore,
	playerDashStore,
	playerListenByDefaultStore,
	playerMiniPlayerStore,
	playerProxyVideosStore,
	playerSavePlaybackPositionStore,
	playerTheatreModeByDefaultStore,
	returnYTDislikesInstanceStore,
	sponsorBlockCategoriesStore,
	sponsorBlockStore,
	sponsorBlockUrlStore,
	synciousInstanceStore,
	synciousStore,
	themeColorStore
} from '../store';

const persistedStores = [
	{
		name: 'returnYTDislikesInstance',
		store: returnYTDislikesInstanceStore,
		type: 'string'
	},
	{
		name: 'darkMode',
		store: darkModeStore,
		type: 'boolean'
	},
	{
		name: 'themeColor',
		store: themeColorStore,
		type: 'string'
	},
	{
		name: 'autoPlay',
		store: playerAutoPlayStore,
		type: 'boolean'
	},
	{
		name: 'alwaysLoop',
		store: playerAlwaysLoopStore,
		type: 'boolean'
	},
	{
		name: 'proxyVideos',
		store: playerProxyVideosStore,
		type: 'boolean'
	},
	{
		name: 'listenByDefault',
		store: playerListenByDefaultStore,
		type: 'boolean'
	},
	{
		name: 'savePlaybackPosition',
		store: playerSavePlaybackPositionStore,
		type: 'boolean'
	},
	{
		name: 'dashEnabled',
		store: playerDashStore,
		type: 'boolean'
	},
	{
		name: 'theatreModeByDefault',
		store: playerTheatreModeByDefaultStore,
		type: 'boolean'
	},
	{
		name: 'autoplayNextByDefault',
		store: playerAutoplayNextByDefaultStore,
		type: 'boolean'
	},
	{
		name: 'returnYtDislikes',
		store: returnYTDislikesInstanceStore,
		type: 'boolean'
	},
	{
		name: 'searchSuggestions',
		store: interfaceSearchSuggestionsStore,
		type: 'boolean'
	},
	{
		name: 'previewVideoOnHover',
		store: interfacePreviewVideoOnHoverStore,
		type: 'boolean'
	},
	{
		name: 'sponsorBlock',
		store: sponsorBlockStore,
		type: 'boolean'
	},
	{
		name: 'sponsorBlockUrl',
		store: sponsorBlockUrlStore,
		type: 'string'
	},
	{
		name: 'sponsorBlockCategories',
		store: sponsorBlockCategoriesStore,
		type: 'array'
	},
	{
		name: 'deArrowInstance',
		store: deArrowInstanceStore,
		type: 'string'
	},
	{
		name: 'deArrowEnabled',
		store: deArrowEnabledStore,
		type: 'boolean'
	},
	{
		name: 'deArrowThumbnailInstance',
		store: deArrowThumbnailInstanceStore,
		type: 'string'
	},
	{
		name: 'playerMiniPlayer',
		store: playerMiniPlayerStore,
		type: 'boolean'
	},
	{
		name: 'syncious',
		store: synciousStore,
		type: 'boolean'
	},
	{
		name: 'synciousInstance',
		store: synciousInstanceStore,
		type: 'string'
	}
];

export function bookmarkletSaveToUrl(): string {
	const url = new URL(location.origin);

	persistedStores.forEach((store) => {
		let value = get(store.store);
		if (value !== null) {
			url.searchParams.set(store.name, value.toString());
		}
	});

	return url.toString();
}

export function bookmarkletLoadFromUrl() {
	const currentPage = get(page);

	persistedStores.forEach((store) => {
		let paramValue = currentPage.url.searchParams.get(store.name);
		if (paramValue) {
			let value: any;

			if (store.type === 'array') {
				value = paramValue.split(',');
			} else if (store.type === 'boolean') {
				value = paramValue === 'true';
			} else {
				value = paramValue;
			}

			store.store.set(value);
		}
	});
}
