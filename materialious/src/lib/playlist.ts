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

	let playlistVideos: PlaylistPageVideo[] = [];
	let playlist: PlaylistPage | undefined = undefined;

	const ignoreVideos: string[] = [];

	for (let page = 1; page < Infinity; page++) {
		const newPlaylist = await getPlaylist(playlistId, page);
		if (page === 1) {
			playlist = newPlaylist;
		}
		let newVideos = newPlaylist.videos;
		if (newVideos.length === 0) {
			break;
		}

		newVideos = newVideos.filter((playlistVideo) => {
			playlistVideo.type = 'video';
			return playlistVideo.lengthSeconds > 0 && !ignoreVideos.includes(playlistVideo.videoId);
		});

		newVideos.forEach((playlistVideo) => {
			ignoreVideos.push(playlistVideo.videoId);
		});

		playlistVideos = [...playlistVideos, ...newVideos].sort(
			(a: PlaylistPageVideo, b: PlaylistPageVideo) => {
				return a.index < b.index ? -1 : 1;
			}
		);
	}

	if (typeof playlist === 'undefined') {
		throw new Error('Unable to fetch playlist');
	}

	const combined = { videos: playlistVideos, info: playlist };
	playlistCacheStore.set({ [playlistId]: combined });

	return combined;
}
