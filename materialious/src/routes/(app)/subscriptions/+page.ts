import { getFeed } from '$lib/api/index';
import type { PlaylistPageVideo, Video, VideoBase } from '$lib/api/model';
import { localDb } from '$lib/dexie';
import { authProtected } from '$lib/auth';
import { feedCacheStore, feedLoadingStore } from '$lib/store';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

type supportedVideos = (VideoBase | Video | PlaylistPageVideo)[];

async function sortVideosByFavourites(videos: supportedVideos): Promise<supportedVideos> {
	if (!window.indexedDB) return videos;

	const favouritedChannels = (await localDb.favouriteChannels.toArray()).map(
		(channel) => channel.channelId
	);

	if (favouritedChannels.length === 0) {
		return videos;
	}

	const regularVideos: supportedVideos = [];
	const favouriteVideos: supportedVideos = [];

	videos.forEach((video) => {
		if (favouritedChannels.includes(video.authorId)) {
			video.promotedBy = 'favourited';
			favouriteVideos.push(video);
		} else {
			regularVideos.push(video);
		}
	});

	return [...favouriteVideos, ...regularVideos];
}

export async function load() {
	authProtected();

	feedLoadingStore.set(true);

	try {
		const feed = await getFeed(100, 1);
		const videos = await sortVideosByFavourites([...feed.notifications, ...feed.videos]);
		feedCacheStore.set({ ...get(feedCacheStore), subscription: videos });
	} catch (e) {
		error(500, e instanceof Error ? e : String(e));
	} finally {
		feedLoadingStore.set(false);
	}
}
