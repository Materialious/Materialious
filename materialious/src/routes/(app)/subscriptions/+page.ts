import { getFeed } from '$lib/api/index';
import type { PlaylistPageVideo, Video, VideoBase } from '$lib/api/model';
import { localDb } from '$lib/dexie';
import { authProtected, excludeDuplicateFeeds } from '$lib/misc';
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

	let videos = get(feedCacheStore).subscription;

	if (!videos) {
		feedCacheStore.set({ ...get(feedCacheStore), subscription: [] });

		feedLoadingStore.set(true);
		getFeed(100, 1)
			.then(async (feed) => {
				videos = await sortVideosByFavourites([...feed.notifications, ...feed.videos]);
				feedCacheStore.set({ ...get(feedCacheStore), subscription: videos });
			})
			.catch((error) => {
				error(500, error);
			})
			.finally(() => {
				feedLoadingStore.set(false);
			});
	} else {
		feedLoadingStore.set(false);

		await getFeed(100, 1).then(async (feeds) => {
			const newVideos = await sortVideosByFavourites([
				...feeds.notifications,
				...feeds.videos,
				...videos
			]);
			feedCacheStore.set({
				...get(feedCacheStore),
				subscription: excludeDuplicateFeeds(videos, newVideos) as (
					| VideoBase
					| Video
					| PlaylistPageVideo
				)[]
			});
		});
	}
}
