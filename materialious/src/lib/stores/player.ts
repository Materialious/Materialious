import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import type { VideoPlay } from '../api/model';
import type { ParsedDescription } from '../description';

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
export const playerMiniplayerEnabled = persist(
	writable(true),
	createStorage(),
	'miniplayerEnabled'
);
export const playerAndroidPauseOnNetworkChange = persist(
	writable(true),
	createStorage(),
	'pauseOnNetworkChange'
);
export const playerPreferredVolumeStore: Writable<number> = persist(
	writable(0.5),
	createStorage(),
	'preferredVolume'
);
export const playerPlaylistHistory: Writable<string[]> = writable([]);

export interface PlayerState {
	data: { video: VideoPlay; content: ParsedDescription; playlistId: string | null };
	playerElement?: HTMLMediaElement | undefined;
}

export const playerState: Writable<PlayerState | undefined> = writable(undefined);

export interface SleepTimerState {
	duration: number;
	remaining: number;
}
export const sleepTimerStore = writable<SleepTimerState | undefined>(undefined);
export const playerTheatreModeIsActive = writable(false);
export const playerIsInWindowFullscreen = writable(false);

export const playlistSettingsStore: Writable<Record<string, { shuffle: boolean; loop: boolean }>> =
	writable({});
