import { Capacitor } from '@capacitor/core';
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { writable, type Writable } from 'svelte/store';
import { Preferences } from '@capacitor/preferences';
import {
	persist,
	createLocalStorage,
	type StorageInterface
} from '@macfja/svelte-persistent-store';
import type { TitleCase } from './letterCasing';
import type {
	Channel,
	HashTag,
	Playlist,
	PlaylistPage,
	PlaylistPageVideo,
	Video,
	VideoBase,
	VideoPlay
} from './api/model';
import { ensureNoTrailingSlash } from './misc';
import type { PhasedDescription } from './timestamps';

function createStorage(): StorageInterface<any> {
	if (Capacitor.getPlatform() === 'android') {
		return {
			getValue(key: string): any | null {
				return Preferences.get({ key: key }).then((value) => {
					return value.value ? JSON.parse(value.value) : value.value;
				});
			},
			deleteValue(key: string) {
				Preferences.remove({ key: key });
			},
			setValue(key: string, value: any) {
				Preferences.set({ key: key, value: JSON.stringify(value) });
			}
		};
	} else {
		return createLocalStorage(true);
	}
}

function platformDependentDefault(givenValue: any, defaultValue: any): any {
	if (typeof givenValue !== 'undefined' && givenValue !== null) {
		return givenValue;
	} else if (defaultValue && Capacitor.getPlatform() !== 'web') {
		return defaultValue;
	}
}

export const instanceStore: Writable<string> = persist(
	writable(
		platformDependentDefault(
			!import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE
				? undefined
				: ensureNoTrailingSlash(import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE),
			'https://invidious.materialio.us'
		)
	),
	createStorage(),
	'invidiousInstance'
);

export const authStore: Writable<null | { username: string; token: string }> = persist(
	writable(null),
	createStorage(),
	'authToken'
);

export const darkModeStore: Writable<null | boolean> = persist(
	writable(null),
	createStorage(),
	'darkMode'
);
export const themeColorStore: Writable<null | string> = persist(
	writable(null),
	createStorage(),
	'themeColor'
);

export const showWarningStore = persist(writable(true), createStorage(), 'showWarning');

export const playerAutoPlayStore = persist(writable(true), createStorage(), 'autoPlay');
export const playerAlwaysLoopStore = persist(writable(false), createStorage(), 'alwaysLoop');
export const playerProxyVideosStore = persist(writable(true), createStorage(), 'proxyVideos');
export const playerSavePlaybackPositionStore = persist(
	writable(true),
	createStorage(),
	'savePlaybackPosition'
);
export const playerTheatreModeByDefaultStore = persist(
	writable(false),
	createStorage(),
	'theatreModeByDefault'
);
export const playerDefaultQualityStore = persist(
	writable('auto'),
	createStorage(),
	'defaultQuality'
);
export const playerAutoplayNextByDefaultStore = persist(
	writable(false),
	createStorage(),
	'autoplayNextByDefault'
);
export const playerYouTubeJsFallback = persist(
	writable(true),
	createStorage(),
	'youTubeJsFallback'
);
export const playerYouTubeJsAlways = persist(writable(false), createStorage(), 'youTubeJsAlways');
export const playerAndroidLockOrientation = persist(
	writable(true),
	createStorage(),
	'androidLockOrientation'
);
export const playerDefaultLanguage = persist(
	writable('original'),
	createStorage(),
	'defaultLanguage'
);
export const playerCCByDefault = persist(writable(false), createStorage(), 'CCByDefault');
export const playerDefaultPlaybackSpeed: Writable<number> = persist(
	writable(1),
	createStorage(),
	'defaultPlaybackSpeed'
);
export const playerStatisticsByDefault = persist(
	writable(false),
	createStorage(),
	'playerStatistics'
);
export const playerMiniplayerEnabled = persist(
	writable(true),
	createStorage(),
	'miniplayerEnabled'
);
export const playerPlaylistHistory: Writable<string[]> = writable([]);

export interface PlayerState {
	data: { video: VideoPlay; content: PhasedDescription; playlistId: string | null };
	isSyncing?: boolean;
	playerElement?: HTMLMediaElement | undefined;
}

export const playerState: Writable<PlayerState | undefined> = writable(undefined);
export const playertheatreModeIsActive = writable(false);

export const returnYtDislikesStore = persist(writable(false), createStorage(), 'returnYtDislikes');
export const returnYTDislikesInstanceStore: Writable<string | null | undefined> = persist(
	writable(
		platformDependentDefault(
			import.meta.env.VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE,
			'https://ryd-proxy.materialio.us'
		)
	),
	createStorage(),
	'returnYTDislikesInstance'
);

export const synciousStore = persist(writable(false), createStorage(), 'syncious');
export const synciousInstanceStore: Writable<string | null | undefined> = persist(
	writable(
		platformDependentDefault(
			import.meta.env.VITE_DEFAULT_SYNCIOUS_INSTANCE ||
				import.meta.env.VITE_DEFAULT_API_EXTENDED_INSTANCE,
			'https://extended-api.materialio.us'
		)
	),
	createStorage(),
	'synciousInstance'
);

export const interfaceRegionStore: Writable<string> = persist(
	writable('US'),
	createStorage(),
	'interfaceRegion'
);
export const interfaceSearchSuggestionsStore = persist(
	writable(true),
	createStorage(),
	'searchSuggestions'
);
export const interfaceForceCase: Writable<TitleCase> = persist(
	writable(null),
	createStorage(),
	'forceCase'
);
export const interfaceAutoExpandComments: Writable<boolean> = persist(
	writable(true),
	createStorage(),
	'autoExpandComments'
);
export const interfaceAutoExpandDesc: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'autoExpandDesc'
);
export const interfaceAutoExpandChapters: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'autoExpandChapters'
);
export const interfaceAmoledTheme = persist(writable(false), createStorage(), 'amoledTheme');
export const interfaceLowBandwidthMode = persist(
	writable(false),
	createStorage(),
	'lowBandwidthMode'
);
export const interfaceDisplayThumbnailAvatars = persist(
	writable(false),
	createStorage(),
	'disableThumbnailAvatars'
);
export const interfaceDefaultPage = persist(writable('/'), createStorage(), 'defaultPage');
export const interfaceSearchHistoryEnabled = persist(
	writable(false),
	createStorage(),
	'searchHistoryEnabled'
);
export const interfaceAllowInsecureRequests = persist(
	writable(false),
	createStorage(),
	'allowInsecureRequests'
);
export const interfaceDisableAutoUpdate = persist(
	writable(false),
	createStorage(),
	'disableAutoUpdate'
);

export const sponsorBlockStore = persist(writable(true), createStorage(), 'sponsorBlock');
export const sponsorBlockUrlStore: Writable<string | null | undefined> = persist(
	writable(import.meta.env.VITE_DEFAULT_SPONSERBLOCK_INSTANCE || 'https://sponsor.ajay.app'),
	createStorage(),
	'sponsorBlockUrl'
);
export const sponsorBlockCategoriesStore: Writable<string[]> = persist(
	writable([]),
	createStorage(),
	'sponsorBlockCategories'
);
export const sponsorBlockDisplayToastStore: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'sponsorBlockDisplayToast'
);
export const sponsorBlockTimelineStore: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'sponsorBlockTimeline'
);

export const deArrowInstanceStore = persist(
	writable(import.meta.env.VITE_DEFAULT_DEARROW_INSTANCE || 'https://sponsor.ajay.app'),
	createStorage(),
	'deArrowInstance'
);
export const deArrowEnabledStore = persist(writable(false), createStorage(), 'deArrowEnabled');
export const deArrowTitlesOnly = persist(writable(true), createStorage(), 'deArrowTitlesOnly');
export const deArrowThumbnailInstanceStore = persist(
	writable(
		import.meta.env.VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE || 'https://dearrow-thumb.ajay.app'
	),
	createStorage(),
	'deArrowThumbnailInstance'
);

export const syncPartyPeerStore: Writable<Peer | null> = writable(null);
export const syncPartyConnectionsStore: Writable<DataConnection[] | null> = writable();

export const playlistSettingsStore: Writable<Record<string, { shuffle: boolean; loop: boolean }>> =
	writable({});

export const poTokenCacheStore: Writable<string | undefined> = writable();

export const searchHistoryStore: Writable<string[]> = persist(
	writable([]),
	createStorage(),
	'searchHistory'
);

export const feedCacheStore: Writable<{
	[key: string]: (VideoBase | Video | PlaylistPageVideo)[];
}> = writable({});
export const searchCacheStore: Writable<{
	[searchTypeAndQuery: string]: (Channel | Video | Playlist | HashTag)[];
}> = writable({});
export const feedLastItemId: Writable<string | undefined> = writable(undefined);
export const playlistCacheStore: Writable<{
	[playlistId: string]: { videos: PlaylistPageVideo[]; info: PlaylistPage };
}> = writable({});

export const isAndroidTvStore: Writable<boolean> = writable(false);
