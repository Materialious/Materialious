import { page } from '$app/stores';
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
	returnYtDislikesStore,
	sponsorBlockCategoriesStore,
	sponsorBlockStore,
	sponsorBlockUrlStore,
	synciousInstanceStore,
	synciousStore,
	themeColorStore
} from '$lib/store';
import { get } from 'svelte/store';

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
		store: returnYtDislikesStore,
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

function setStores(toSet: Record<string, any>) {
	persistedStores.forEach((store) => {
		let userOverwritten: boolean = false;
		try {
			userOverwritten = localStorage.getItem(store.name) !== null;
		} catch { }

		let paramValue = toSet[store.name];
		if (typeof paramValue !== 'undefined' && !userOverwritten) {
			let value: any;

			if (store.type === 'array') {
				value = paramValue.split(',');
			} else if (store.type === 'boolean') {
				value = typeof paramValue === 'string' ? paramValue === 'true' : paramValue;
			} else {
				value = paramValue;
			}

			store.store.set(value);

			// Kinda backwards but delete out of localstorage after setting
			// So can be changed in the future.
			try {
				localStorage.removeItem(store.name);
			} catch { }
		}
	});
}

export function loadSettingsFromEnv() {
	if (typeof import.meta.env.VITE_DEFAULT_SETTINGS !== 'string') return;

	// If $VITE_DEFAULT_SETTINGS is passed via docker, it will be wrapped with quotations.
	let defaultSettingsJson = import.meta.env.VITE_DEFAULT_SETTINGS;

	if (defaultSettingsJson.startsWith('"')) {
		defaultSettingsJson = defaultSettingsJson.slice(1);
	}

	if (defaultSettingsJson.endsWith('"')) {
		defaultSettingsJson = defaultSettingsJson.slice(0, -1);
	}

	try {
		const defaultSettings = JSON.parse(defaultSettingsJson);
		setStores(defaultSettings);
	} catch (error) {
		console.log(error);
	}
}

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

	const toSet: Record<string, string> = {};

	currentPage.url.searchParams.forEach((value, key) => {
		toSet[key] = value;
	});

	setStores(toSet);
}
