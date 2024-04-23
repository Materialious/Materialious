import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';

export const returnYTDislikesInstanceStore = persisted(
	'returnYTDislikesInstance',
	import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE
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

export const returnYtDislikesStore = persisted('returnYtDislikes', false);

export const interfaceSearchSuggestionsStore = persisted('searchSuggestions', true);
export const interfacePreviewVideoOnHoverStore = persisted('previewVideoOnHover', true);

export const authStore: Writable<null | { username: string; token: string; }> = persisted(
	'authToken',
	null
);

export const sponsorBlockStore = persisted('sponsorBlock', true);
export const sponsorBlockUrlStore: Writable<string | null | undefined> = persisted(
	'sponsorBlockUrl',
	import.meta.env.VITE_DEFAULT_SPONSERBLOCK_INSTANCE
);
export const sponsorBlockCategoriesStore: Writable<string[]> = persisted('sponsorBlockCategories', []);

export const deArrowInstanceStore = persisted(
	'deArrowInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_INSTANCE
);
export const deArrowEnabledStore = persisted('deArrowEnabled', false);
export const deArrowThumbnailInstanceStore = persisted(
	'deArrowThumbnailInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE
);

export const syncPartyPeerStore: Writable<Peer | null> = writable(null);
export const syncPartyConnectionsStore: Writable<DataConnection[] | null> = writable();

export const playlistSettingsStore: Writable<Record<string, { shuffle: boolean, loop: boolean; }>> = writable({});