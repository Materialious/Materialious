import type { VideoPlay } from '$lib/Api/model';
import { Capacitor } from '@capacitor/core';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';
import type { TitleCase } from './misc';
import type { PoTokens } from './patches/poTokenAndroid';

function platformDependentDefault(givenValue: any, defaultValue: any): any {
	if (typeof givenValue !== 'undefined' && typeof givenValue !== null) {
		return givenValue;
	} else if (defaultValue && Capacitor.getPlatform() !== 'web') {
		return defaultValue;
	}
}

export const instanceStore: Writable<string> = persisted(
	"invidiousInstance",
	platformDependentDefault(import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE, 'https://invidious.materialio.us')
);

export const authStore: Writable<null | { username: string; token: string; }> = persisted(
	'authToken',
	null
);

export const darkModeStore: Writable<null | boolean> = persisted('darkMode', null);
export const themeColorStore: Writable<null | string> = persisted('themeColor', null);

export const activePageStore: Writable<string | null> = writable('home');

export const playerAutoPlayStore = persisted('autoPlay', true);
export const playerAlwaysLoopStore = persisted('alwaysLoop', false);
export const playerProxyVideosStore = persisted('proxyVideos', true);
export const playerListenByDefaultStore = persisted('listenByDefault', false);
export const playerSavePlaybackPositionStore = persisted('savePlaybackPosition', true);
export const playerTheatreModeByDefaultStore = persisted('theatreModeByDefault', false);
export const playerAutoplayNextByDefaultStore = persisted('autoplayNextByDefault', false);
export const playerMiniPlayerStore = persisted('miniPlayer', true);
export const playerYouTubeJsFallback = persisted('youTubeJsFallback', true);

export const returnYtDislikesStore = persisted('returnYtDislikes', false);
export const returnYTDislikesInstanceStore: Writable<string | null | undefined> = persisted(
	'returnYTDislikesInstance',
	platformDependentDefault(import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE, 'https://ryd-proxy.materialio.us')
);

export const synciousStore = persisted('syncious', true);
export const synciousInstanceStore: Writable<string | null | undefined> = persisted(
	'synciousInstance',
	platformDependentDefault(import.meta.env.VITE_DEFAULT_SYNCIOUS_INSTANCE || import.meta.env.VITE_DEFAULT_API_EXTENDED_INSTANCE, 'https://extended-api.materialio.us')
);

export const interfaceRegionStore: Writable<string> = persisted('interfaceRegion', 'US');
export const interfaceSearchSuggestionsStore = persisted('searchSuggestions', true);
export const interfacePreviewVideoOnHoverStore = persisted('previewVideoOnHover', true);
export const interfaceForceCase: Writable<TitleCase> = persisted('forceCase', null);
export const interfaceAutoExpandComments: Writable<boolean> = persisted('autoExpandComments', true);
export const interfaceAutoExpandDesc: Writable<boolean> = persisted('autoExpandDesc', false);

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

export const playlistSettingsStore: Writable<Record<string, { shuffle: boolean; loop: boolean; }>> =
	writable({});

export const miniPlayerSrcStore: Writable<{ video: VideoPlay; time: number; } | null> =
	writable(null);

export const silenceSkipperStore: Writable<boolean> = persisted('silenceSkipper', false);

export const poTokenCacheStore: Writable<PoTokens> = writable();
