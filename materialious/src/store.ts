import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { persisted } from 'svelte-persisted-store';
import { writable, type Writable } from 'svelte/store';

export const returnYTDislikesInstance = persisted(
	'returnYTDislikesInstance',
	import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE
);
export const darkMode: Writable<null | boolean> = persisted('darkMode', null);
export const themeColor: Writable<null | string> = persisted('themeColor', null);

export const activePage: Writable<string | null> = writable('home');

export const playerAutoPlay = persisted('autoPlay', true);
export const playerAlwaysLoop = persisted('alwaysLoop', false);
export const playerProxyVideos = persisted('proxyVideos', false);
export const playerListenByDefault = persisted('listenByDefault', false);
export const playerSavePlaybackPosition = persisted('savePlaybackPosition', true);
export const playerDash = persisted('dashEnabled', false);
export const playerTheatreModeByDefault = persisted('theatreModeByDefault', false);
export const playerAutoplayNextByDefault = persisted('autoplayNextByDefault', false);

export const returnYtDislikes = persisted('returnYtDislikes', true);

export const interfaceSearchSuggestions = persisted('searchSuggestions', true);
export const interfacePreviewVideoOnHover = persisted('previewVideoOnHover', true);

export const auth: Writable<null | { username: string; token: string; }> = persisted(
	'authToken',
	null
);

export const sponsorBlock = persisted('sponsorBlock', true);
export const sponsorBlockUrl = persisted(
	'sponsorBlockUrl',
	import.meta.env.VITE_DEFAULT_SPONSERBLOCK_INSTANCE
);
export const sponsorBlockCategories: Writable<string[]> = persisted('sponsorBlockCategories', []);

export const deArrowInstance = persisted(
	'deArrowInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_INSTANCE
);
export const deArrowEnabled = persisted('deArrowEnabled', false);
export const deArrowThumbnailInstance = persisted(
	'deArrowThumbnailInstance',
	import.meta.env.VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE
);

export const syncPartyPeer: Writable<Peer | null> = writable(null);
export const syncPartyConnections: Writable<DataConnection[] | null> = writable();

export const playlistSettings: Writable<Record<string, { shuffle: boolean, loop: boolean; }>> = writable({});