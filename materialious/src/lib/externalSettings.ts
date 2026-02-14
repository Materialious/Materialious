import { page } from '$app/state';
import { get, type Writable } from 'svelte/store';
import { z } from 'zod';

import { env } from '$env/dynamic/public';

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
	sponsorBlockDisplayToastStore,
	sponsorBlockStore,
	sponsorBlockUrlStore,
	synciousInstanceStore,
	synciousStore,
	themeColorStore,
	interfaceAutoExpandChapters,
	playerDefaultPlaybackSpeed,
	playerCCByDefault,
	playerMiniplayerEnabled,
	sponsorBlockCategoriesStore
} from '$lib/store';

type PersistedStore<T> = {
	name: string;
	store: Writable<T>;
	schema: z.ZodType<T>;
	serialize?: (value: T) => string;
};

function parseWithSchema<T>(schema: z.ZodType<T>, raw: unknown): T | undefined {
	try {
		if (typeof raw === 'string') {
			// Try JSON first (records / objects)
			try {
				return schema.parse(JSON.parse(raw));
			} catch {
				return schema.parse(raw);
			}
		}
		return schema.parse(raw);
	} catch {
		return undefined;
	}
}

const zBoolean = z.coerce.boolean();
const zNumber = z.coerce.number();
const zString = z.string();
const zChapterMode = z.enum(['automatic', 'manual', 'timeline']);
const zChapterModeRecord = z.record(z.string(), zChapterMode.optional());

const persistedStores: PersistedStore<any>[] = [
	{
		name: 'returnYTDislikesInstance',
		store: returnYTDislikesInstanceStore,
		schema: zString
	},
	{
		name: 'darkMode',
		store: darkModeStore,
		schema: zBoolean
	},
	{
		name: 'themeColor',
		store: themeColorStore,
		schema: zString
	},
	{
		name: 'autoPlay',
		store: playerAutoPlayStore,
		schema: zBoolean
	},
	{
		name: 'alwaysLoop',
		store: playerAlwaysLoopStore,
		schema: zBoolean
	},
	{
		name: 'proxyVideos',
		store: playerProxyVideosStore,
		schema: zBoolean
	},
	{
		name: 'savePlaybackPosition',
		store: playerSavePlaybackPositionStore,
		schema: zBoolean
	},
	{
		name: 'theatreModeByDefault',
		store: playerTheatreModeByDefaultStore,
		schema: zBoolean
	},
	{
		name: 'autoplayNextByDefault',
		store: playerAutoplayNextByDefaultStore,
		schema: zBoolean
	},
	{
		name: 'returnYtDislikes',
		store: returnYtDislikesStore,
		schema: zBoolean
	},
	{
		name: 'searchSuggestions',
		store: interfaceSearchSuggestionsStore,
		schema: zBoolean
	},
	{
		name: 'sponsorBlock',
		store: sponsorBlockStore,
		schema: zBoolean
	},
	{
		name: 'sponsorBlockUrl',
		store: sponsorBlockUrlStore,
		schema: zString
	},
	{
		name: 'deArrowInstance',
		store: deArrowInstanceStore,
		schema: zString
	},
	{
		name: 'deArrowEnabled',
		store: deArrowEnabledStore,
		schema: zBoolean
	},
	{
		name: 'deArrowThumbnailInstance',
		store: deArrowThumbnailInstanceStore,
		schema: zString
	},
	{
		name: 'syncious',
		store: synciousStore,
		schema: zBoolean
	},
	{
		name: 'synciousInstance',
		store: synciousInstanceStore,
		schema: zString
	},
	{
		name: 'region',
		store: interfaceRegionStore,
		schema: zString
	},
	{
		name: 'forceCase',
		store: interfaceForceCase,
		schema: zString
	},
	{
		name: 'autoExpandComments',
		store: interfaceAutoExpandComments,
		schema: zBoolean
	},
	{
		name: 'autoExpandDesc',
		store: interfaceAutoExpandDesc,
		schema: zBoolean
	},
	{
		name: 'deArrowTitlesOnly',
		store: deArrowTitlesOnly,
		schema: zBoolean
	},
	{
		name: 'sponsorBlockDisplayToast',
		store: sponsorBlockDisplayToastStore,
		schema: zBoolean
	},
	{
		name: 'amoledTheme',
		store: interfaceAmoledTheme,
		schema: zBoolean
	},
	{
		name: 'showWarning',
		store: showWarningStore,
		schema: zBoolean
	},
	{
		name: 'lowBandwidthMode',
		store: interfaceLowBandwidthMode,
		schema: zBoolean
	},
	{
		name: 'displayThumbnailAvatars',
		store: interfaceDisplayThumbnailAvatars,
		schema: zBoolean
	},
	{
		name: 'defaultLanguage',
		store: playerDefaultLanguage,
		schema: zString
	},
	{
		name: 'defaultPage',
		store: interfaceDefaultPage,
		schema: zString
	},
	{
		name: 'defaultQuality',
		store: playerDefaultQualityStore,
		schema: zString
	},
	{
		name: 'autoExpandChapters',
		store: interfaceAutoExpandChapters,
		schema: zBoolean
	},
	{
		name: 'defaultPlaybackSpeed',
		store: playerDefaultPlaybackSpeed,
		schema: zNumber
	},
	{
		name: 'CCByDefault',
		store: playerCCByDefault,
		schema: zBoolean
	},
	{
		name: 'miniplayerEnabled',
		store: playerMiniplayerEnabled,
		schema: zBoolean
	},
	{
		name: 'sponsorBlockCategoriesv2',
		store: sponsorBlockCategoriesStore,
		schema: zChapterModeRecord,
		serialize: JSON.stringify
	}
];

function setStores(toSet: Record<string, unknown>, overwriteExisting = false) {
	if (!overwriteExisting) return;

	for (const { name, store, schema } of persistedStores) {
		const raw = toSet[name];
		if (raw === undefined) continue;

		const parsed = parseWithSchema(schema, raw);
		if (parsed !== undefined) {
			store.set(parsed);
		}
	}
}

export function loadSettingsFromEnv() {
	if (
		typeof import.meta.env.VITE_DEFAULT_SETTINGS !== 'string' &&
		typeof env.PUBLIC_DEFAULT_SETTINGS !== 'string'
	)
		return;

	let raw = import.meta.env.VITE_DEFAULT_SETTINGS || env.PUBLIC_DEFAULT_SETTINGS;

	// Docker wraps env vars in quotes
	if (raw.startsWith('"')) raw = raw.slice(1);
	if (raw.endsWith('"')) raw = raw.slice(0, -1);

	let isInitialLoad = false;
	try {
		if (localStorage.getItem('initialLoadState') === null) {
			isInitialLoad = true;
			localStorage.setItem('initialLoadState', '0');
		}
	} catch {
		isInitialLoad = true;
	}

	try {
		const parsed = JSON.parse(raw);
		setStores(parsed, isInitialLoad);
	} catch (err) {
		console.error(err);
	}
}

export function bookmarkletSaveToUrl(): string {
	const url = new URL(location.origin);

	for (const { name, store, serialize } of persistedStores) {
		const value = get(store);
		const encoded = serialize ? serialize(value) : value?.toString();

		if (encoded !== undefined) {
			url.searchParams.set(name, encoded);
		}
	}

	return url.toString();
}

export function bookmarkletLoadFromUrl() {
	const toSet: Record<string, string> = {};

	page.url.searchParams.forEach((value, key) => {
		toSet[key] = value;
	});

	setStores(toSet, true);
}
