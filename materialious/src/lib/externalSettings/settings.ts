import { z } from 'zod';
import { type Writable } from 'svelte/store';

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
	sponsorBlockCategoriesStore,
	invidiousAuthStore,
	backendInUseStore,
	invidiousInstanceStore,
	engineFallbacksStore,
	engineMaxConcurrentChannelsStore,
	engineCooldownYTStore,
	engineCullYTStore,
	interfaceAllowInsecureRequests,
	interfaceDisableAutoUpdate,
	interfaceAndroidUseNativeShare,
	playerAndroidPauseOnNetworkChange,
	playerAndroidLockOrientation,
	playerYouTubeJsFallback,
	playerYouTubeJsAlways,
	interfaceSearchHistoryEnabled
} from '$lib/store';
import { isOwnBackend } from '$lib/shared';

type PersistedStore<T> = {
	name: string;
	store: Writable<T>;
	schema: z.ZodType<T>;
	serialize?: (value: T) => string;
};

const zBoolean = z.coerce.boolean();
const zNumber = z.coerce.number();
const zString = z.string();
const zArray = z.array(z.string());
const zChapterMode = z.enum(['automatic', 'manual', 'timeline']);
const zChapterModeRecord = z.record(z.string(), zChapterMode.optional());
const zAuth = z.object({
	username: z.string(),
	token: z.string()
});

export const persistedStores: PersistedStore<any>[] = [
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
		name: 'searchHistoryEnabled',
		store: interfaceSearchHistoryEnabled,
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

// If using own backend with can support more externalSettings.
if (isOwnBackend()) {
	persistedStores.push({
		name: 'authToken',
		store: invidiousAuthStore,
		schema: zAuth,
		serialize: JSON.stringify
	});
	persistedStores.push({
		name: 'backendInUse',
		store: backendInUseStore,
		schema: zString
	});
	persistedStores.push({
		name: 'invidiousInstance',
		store: invidiousInstanceStore,
		schema: zString
	});
	persistedStores.push({
		name: 'engineFallbacks',
		store: engineFallbacksStore,
		schema: zArray
	});
	persistedStores.push({
		name: 'engineMaxConcurrentChannels',
		store: engineMaxConcurrentChannelsStore,
		schema: zNumber
	});
	persistedStores.push({
		name: 'engineCooldownYT',
		store: engineCooldownYTStore,
		schema: zNumber
	});
	persistedStores.push({
		name: 'engineCullYT',
		store: engineCullYTStore,
		schema: zNumber
	});
	persistedStores.push({
		name: 'allowInsecureRequests',
		store: interfaceAllowInsecureRequests,
		schema: zString
	});
	persistedStores.push({
		name: 'disableAutoUpdate',
		store: interfaceDisableAutoUpdate,
		schema: zString
	});
	persistedStores.push({
		name: 'androidUseNativeShare',
		store: interfaceAndroidUseNativeShare,
		schema: zString
	});
	persistedStores.push({
		name: 'pauseOnNetworkChange',
		store: playerAndroidPauseOnNetworkChange,
		schema: zBoolean
	});
	persistedStores.push({
		name: 'androidLockOrientation',
		store: playerAndroidLockOrientation,
		schema: zBoolean
	});
	persistedStores.push({
		name: 'youTubeJsFallback',
		store: playerYouTubeJsFallback,
		schema: zBoolean
	});
	persistedStores.push({
		name: 'youTubeJsAlways',
		store: playerYouTubeJsAlways,
		schema: zBoolean
	});
}

export const persistedStoreKeys = persistedStores.map((store) => store.name);
