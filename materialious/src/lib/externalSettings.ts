import { page } from '$app/stores';
import {
	darkModeStore,
	deArrowEnabledStore,
	deArrowInstanceStore,
	deArrowThumbnailInstanceStore,
	deArrowTitlesOnly,
	interfaceAmoledTheme,
	interfaceAutoExpandComments,
	interfaceAutoExpandDesc,
	interfaceDefaultPage,
	interfaceDisplayThumbnailAvatars,
	interfaceForceCase,
	interfaceLowBandwidthMode,
	interfaceRegionStore,
	interfaceSearchSuggestionsStore,
	playerAlwaysLoopStore,
	playerAutoPlayStore,
	playerAutoplayNextByDefaultStore,
	playerDefaultLanguage,
	playerDefaultQualityStore,
	playerProxyVideosStore,
	playerSavePlaybackPositionStore,
	playerTheatreModeByDefaultStore,
	returnYTDislikesInstanceStore,
	returnYtDislikesStore,
	showWarningStore,
	sponsorBlockCategoriesStore,
	sponsorBlockDisplayToastStore,
	sponsorBlockStore,
	sponsorBlockUrlStore,
	synciousInstanceStore,
	synciousStore,
	themeColorStore,
	interfaceAutoExpandChapters
} from '$lib/store';
import { get, type Writable } from 'svelte/store';

const persistedStores: {
	name: string;
	store: Writable<any>;
	type: 'string' | 'boolean' | 'array';
}[] = [
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
		name: 'savePlaybackPosition',
		store: playerSavePlaybackPositionStore,
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
		name: 'syncious',
		store: synciousStore,
		type: 'boolean'
	},
	{
		name: 'synciousInstance',
		store: synciousInstanceStore,
		type: 'string'
	},
	{
		name: 'region',
		store: interfaceRegionStore,
		type: 'string'
	},
	{
		name: 'forceCase',
		store: interfaceForceCase,
		type: 'string'
	},
	{
		name: 'autoExpandComments',
		store: interfaceAutoExpandComments,
		type: 'boolean'
	},
	{
		name: 'autoExpandDesc',
		store: interfaceAutoExpandDesc,
		type: 'boolean'
	},
	{
		name: 'deArrowTitlesOnly',
		store: deArrowTitlesOnly,
		type: 'boolean'
	},
	{
		name: 'sponsorBlockDisplayToast',
		store: sponsorBlockDisplayToastStore,
		type: 'boolean'
	},
	{
		name: 'amoledTheme',
		store: interfaceAmoledTheme,
		type: 'boolean'
	},
	{
		name: 'showWarning',
		store: showWarningStore,
		type: 'boolean'
	},
	{
		name: 'lowBandwidthMode',
		store: interfaceLowBandwidthMode,
		type: 'boolean'
	},
	{
		name: 'displayThumbnailAvatars',
		store: interfaceDisplayThumbnailAvatars,
		type: 'boolean'
	},
	{
		name: 'defaultLanguage',
		store: playerDefaultLanguage,
		type: 'boolean'
	},
	{
		name: 'defaultPage',
		store: interfaceDefaultPage,
		type: 'string'
	},
	{
		name: 'defaultQuality',
		store: playerDefaultQualityStore,
		type: 'string'
	},
	{
		name: 'autoExpandChapters',
		store: interfaceAutoExpandChapters,
		type: 'boolean'
	}
];

function setStores(toSet: Record<string, any>) {
	persistedStores.forEach((store) => {
		let userOverwritten: boolean = false;
		try {
			userOverwritten = localStorage.getItem(store.name) !== null;
		} catch {}

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
		if (value !== null && value !== undefined) {
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
