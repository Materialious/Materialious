import { get } from 'svelte/store';
import { getPlaylist } from './api';
import type { PlaylistPage, PlaylistPageVideo } from './api/model';
import { playlistCacheStore } from './store';

export async function loadEntirePlaylist(
	playlistId: string
): Promise<{ videos: PlaylistPageVideo[]; info: PlaylistPage }> {
	const cachedPlaylists = get(playlistCacheStore);
	if (playlistId in cachedPlaylists) {
		return cachedPlaylists[playlistId];
	}

	const playlistVideos: PlaylistPageVideo[] = [];
	const ignoreVideos = new Set<string>();

	let newPlaylist = await getPlaylist(playlistId, 1);
	if (newPlaylist.getContinuation) {
		let firstVideoId: string = '';

		processVideos(newPlaylist.videos, ignoreVideos, playlistVideos);

		while (newPlaylist.getContinuation) {
			const continuationResult = await newPlaylist.getContinuation();
			processVideos(continuationResult.videos, ignoreVideos, playlistVideos);

			if (firstVideoId === continuationResult.videos[0].videoId) break;

			firstVideoId = continuationResult.videos[0].videoId;
		}
	} else {
		let page = 1;
		while (true) {
			newPlaylist = await getPlaylist(playlistId, page);

			if (newPlaylist.videos.length === 0) {
				break;
			}

			processVideos(newPlaylist.videos, ignoreVideos, playlistVideos);

			page++;
		}
	}

	const combined = { videos: playlistVideos, info: newPlaylist };
	playlistCacheStore.set({ [playlistId]: combined });

	return combined;
}

function processVideos(
	videos: PlaylistPageVideo[],
	ignoreVideos: Set<string>,
	playlistVideos: PlaylistPageVideo[]
) {
	const newVideos = videos.filter((playlistVideo) => {
		playlistVideo.type = 'video';
		return playlistVideo.lengthSeconds > 0 && !ignoreVideos.has(playlistVideo.videoId);
	});

	newVideos.forEach((playlistVideo) => {
		ignoreVideos.add(playlistVideo.videoId);
	});

	playlistVideos.push(...newVideos);
	playlistVideos.sort((a: PlaylistPageVideo, b: PlaylistPageVideo) => a.index - b.index);
}
