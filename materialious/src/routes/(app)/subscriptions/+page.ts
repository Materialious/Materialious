import { getFeed } from '$lib/api/index';
import type { PlaylistPageVideo, Video, VideoBase } from '$lib/api/model';
import { localDb } from '$lib/dexie';
import { excludeDuplicateFeeds } from '$lib/misc';
import { feedCacheStore } from '$lib/store';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

async function sortVideosByFavourites(
	videos: (VideoBase | Video | PlaylistPageVideo)[]
): Promise<(VideoBase | Video | PlaylistPageVideo)[]> {
	if (!window.indexedDB) return videos;

	const favouritedChannels = (await localDb.favouriteChannels.toArray()).map(
		(channel) => channel.channelId
	);

	if (favouritedChannels.length === 0) {
		return videos;
	}

	const rearrangedVideos: (VideoBase | Video | PlaylistPageVideo)[] = [];

	videos.forEach((video) => {
		if (favouritedChannels.includes(video.authorId)) {
			video.promotedBy = 'favourited';
			rearrangedVideos.unshift(video);
		} else {
			rearrangedVideos.push(video);
		}
	});

	return rearrangedVideos;
}

export async function load() {
	let videos = get(feedCacheStore).subscription;

	if (!videos) {
		let feeds;
		try {
			feeds = await getFeed(100, 1);
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}

		videos = await sortVideosByFavourites([...feeds.notifications, ...feeds.videos]);

		feedCacheStore.set({ ...get(feedCacheStore), subscription: videos });
	} else {
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
