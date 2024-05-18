import type { VideoPlay } from '$lib/Api/model';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';
import type { titleCase } from './misc';

export const instanceStore: Writable<string> = persisted(
	"invidiousInstance",
	import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE || 'https://invidious.materialio.us'
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
export const playerProxyVideosStore = persisted('proxyVideos', false);
export const playerListenByDefaultStore = persisted('listenByDefault', false);
export const playerSavePlaybackPositionStore = persisted('savePlaybackPosition', true);
export const playerDashStore = persisted('dashEnabled', false);
export const playerTheatreModeByDefaultStore = persisted('theatreModeByDefault', false);
export const playerAutoplayNextByDefaultStore = persisted('autoplayNextByDefault', false);
export const playerMiniPlayerStore = persisted('miniPlayer', true);
export const playerAndroidBackgroundPlayStore = persisted('androidBackgroundPlayer', true);

export const returnYtDislikesStore = persisted('returnYtDislikes', false);
export const returnYTDislikesInstanceStore: Writable<string | null | undefined> = persisted(
	'returnYTDislikesInstance',
	import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE || 'https://ryd-proxy.materialio.us'
);

export const synciousStore = persisted('syncious', true);
export const synciousInstanceStore: Writable<string | null | undefined> = persisted(
	'synciousInstance',
	import.meta.env.VITE_DEFAULT_SYNCIOUS_INSTANCE || 'https://syncious.materialio.us'
);

export const interfaceRegionStore: Writable<string> = persisted('interfaceRegion', 'US');
export const interfaceSearchSuggestionsStore = persisted('searchSuggestions', true);
export const interfacePreviewVideoOnHoverStore = persisted('previewVideoOnHover', true);
export const interfaceForceCase: Writable<titleCase> = persisted('forceCase', null);

export const sponsorBlockStore = persisted('sponsorBlock', true);
export const sponsorBlockUrlStore: Writable<string | null | undefined> = persisted(
	'sponsorBlockUrl',
	import.meta.env.VITE_DEFAULT_SPONSERBLOCK_INSTANCE || 'https://sponsor.ajay.app'
);
export const sponsorBlockCategoriesStore: Writable<string[]> = persisted(
	'sponsorBlockCategories',
	[]
);

export const deArrowInstanceStore = persisted(
	'deArrowInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_INSTANCE || 'https://sponsor.ajay.app'
);
export const deArrowEnabledStore = persisted('deArrowEnabled', false);
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

