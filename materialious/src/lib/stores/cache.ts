import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import type { ChannelContent, ChannelPage, PlaylistPage, PlaylistPageVideo, SearchResults, Video, VideoBase } from '../api/model';

export const searchHistoryStore: Writable<string[]> = persist(
	writable([]),
	createStorage(),
	'searchHistory'
);

export const feedLoadingStore: Writable<boolean> = writable(false);
export const feedCacheStore: Writable<{
	[key: string]: (VideoBase | Video | PlaylistPageVideo)[];
}> = writable({});
export const searchCacheStore: Writable<{
	[searchTypeAndQuery: string]: SearchResults;
}> = writable({});
export const feedLastItemId: Writable<string | undefined> = writable(undefined);
export const playlistCacheStore: Writable<{
	[playlistId: string]: { videos: PlaylistPageVideo[]; info: PlaylistPage };
}> = writable({});

export const channelCacheStore: Writable<{
	[key: string]: {
		channel: ChannelPage;
		displayContent: { [key: string]: ChannelContent };
	};
}> = writable({});
