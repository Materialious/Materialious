import { Capacitor } from '@capacitor/core';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';
import type { TitleCase } from './letterCasing';
import type { Channel, HashTag, Playlist, PlaylistPageVideo, Video, VideoBase } from './api/model';
import { ensureNoTrailingSlash } from './misc';

function platformDependentDefault(givenValue: any, defaultValue: any): any {
	if (typeof givenValue !== 'undefined' && typeof givenValue !== null) {
		return givenValue;
	} else if (defaultValue && Capacitor.getPlatform() !== 'web') {
		return defaultValue;
	}
}

export const instanceStore: Writable<string> = persisted(
	'invidiousInstance',
	platformDependentDefault(
		!import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE
			? undefined
			: ensureNoTrailingSlash(import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE),
		'https://invidious.materialio.us'
	)
);

export const authStore: Writable<null | { username: string; token: string }> = persisted(
	'authToken',
	null
);

export const darkModeStore: Writable<null | boolean> = persisted('darkMode', null);
export const themeColorStore: Writable<null | string> = persisted('themeColor', null);

export const showWarningStore = persisted('showWarning', true);

export const playerAutoPlayStore = persisted('autoPlay', true);
export const playerAlwaysLoopStore = persisted('alwaysLoop', false);
export const playerProxyVideosStore = persisted('proxyVideos', true);
export const playerSavePlaybackPositionStore = persisted('savePlaybackPosition', true);
export const playerTheatreModeByDefaultStore = persisted('theatreModeByDefault', false);
export const playerDefaultQualityStore = persisted('defaultQuality', 'auto');
export const playerAutoplayNextByDefaultStore = persisted('autoplayNextByDefault', false);
export const playerYouTubeJsFallback = persisted('youTubeJsFallback', true);
export const playerYouTubeJsAlways = persisted('youTubeJsAlways', false);
export const playerAndroidLockOrientation = persisted('androidLockOrientation', true);
export const playerDefaultLanguage = persisted('defaultLanguage', '');

export const returnYtDislikesStore = persisted('returnYtDislikes', false);
export const returnYTDislikesInstanceStore: Writable<string | null | undefined> = persisted(
	'returnYTDislikesInstance',
	platformDependentDefault(
		import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE,
		'https://ryd-proxy.materialio.us'
	)
);

export const synciousStore = persisted('syncious', true);
export const synciousInstanceStore: Writable<string | null | undefined> = persisted(
	'synciousInstance',
	platformDependentDefault(
		import.meta.env.VITE_DEFAULT_SYNCIOUS_INSTANCE ||
			import.meta.env.VITE_DEFAULT_API_EXTENDED_INSTANCE,
		'https://extended-api.materialio.us'
	)
);

export const interfaceRegionStore: Writable<string> = persisted('interfaceRegion', 'US');
export const interfaceSearchSuggestionsStore = persisted('searchSuggestions', true);
export const interfaceForceCase: Writable<TitleCase> = persisted('forceCase', null);
export const interfaceAutoExpandComments: Writable<boolean> = persisted('autoExpandComments', true);
export const interfaceAutoExpandDesc: Writable<boolean> = persisted('autoExpandDesc', false);
export const interfaceAutoExpandChapters: Writable<boolean> = persisted(
	'autoExpandChapters',
	false
);
export const interfaceAmoledTheme = persisted('amoledTheme', false);
export const interfaceLowBandwidthMode = persisted('lowBandwidthMode', false);
export const interfaceDisplayThumbnailAvatars = persisted('disableThumbnailAvatars', false);
export const interfaceDefaultPage = persisted('defaultPage', '/');
export const interfaceSearchHistoryEnabled = persisted('searchHistoryEnabled', false);
export const interfaceAllowInsecureRequests = persisted('allowInsecureRequests', false);

export const sponsorBlockStore = persisted('sponsorBlock', true);
export const sponsorBlockUrlStore: Writable<string | null | undefined> = persisted(
	'sponsorBlockUrl',
	import.meta.env.VITE_DEFAULT_SPONSERBLOCK_INSTANCE || 'https://sponsor.ajay.app'
);
export const sponsorBlockCategoriesStore: Writable<string[]> = persisted(
	'sponsorBlockCategories',
	[]
);
export const sponsorBlockDisplayToastStore: Writable<boolean> = persisted(
	'sponsorBlockDisplayToast',
	false
);
export const sponsorBlockTimelineStore: Writable<boolean> = persisted(
	'sponsorBlockTimeline',
	false
);

export const deArrowInstanceStore = persisted(
	'deArrowInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_INSTANCE || 'https://sponsor.ajay.app'
);
export const deArrowEnabledStore = persisted('deArrowEnabled', false);
export const deArrowTitlesOnly = persisted('deArrowTitlesOnly', true);
export const deArrowThumbnailInstanceStore = persisted(
	'deArrowThumbnailInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE || 'https://dearrow-thumb.ajay.app'
);

export const syncPartyPeerStore: Writable<Peer | null> = writable(null);
export const syncPartyConnectionsStore: Writable<DataConnection[] | null> = writable();

export const playlistSettingsStore: Writable<Record<string, { shuffle: boolean; loop: boolean }>> =
	writable({});

export const poTokenCacheStore: Writable<string | undefined> = writable();

export const searchHistoryStore: Writable<string[]> = persisted('searchHistory', []);

export const feedCacheStore: Writable<{
	[key: string]: (VideoBase | Video | PlaylistPageVideo)[];
}> = writable({});
export const searchCacheStore: Writable<{
	[searchTypeAndQuery: string]: (Channel | Video | Playlist | HashTag)[];
}> = writable({});
export const feedLastItemId: Writable<string | undefined> = writable(undefined);
