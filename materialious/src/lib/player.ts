import { get } from 'svelte/store';
import type { PlaylistPageVideo, VideoPlay } from './api/model';
import {
	isAndroidTvStore,
	playerAutoplayNextByDefaultStore,
	playerPlaylistHistory,
	playlistSettingsStore,
	syncPartyConnectionsStore
} from './store';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { loadEntirePlaylist } from './playlist';
import { unsafeRandomItem } from './misc';

export interface PlayerEvent {
	type: 'pause' | 'seek' | 'change-video' | 'play' | 'playlist' | 'goto';
	path?: string;
	time?: number;
	videoId?: string;
	playlistId?: string;
}

export interface PlayerEvents {
	events: PlayerEvent[];
}

export const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];

export function goToPreviousVideo(playlistId: string | null) {
	const previousVideos = get(playerPlaylistHistory);
	if (previousVideos.length > 1) {
		goto(
			resolve('/watch/[videoId]?playlist=[playlistId]', {
				videoId: previousVideos[1],
				playlistId: playlistId ?? ''
			})
		);
		delete previousVideos[1];
	}
}

export async function goToNextVideo(video: VideoPlay, playlistId: string | null) {
	const isAndroidTv = get(isAndroidTvStore);

	if (!playlistId) {
		if (get(playerAutoplayNextByDefaultStore)) {
			goto(resolve(`/${isAndroidTv ? 'tv' : 'watch'}/${video.recommendedVideos[0].videoId}`), {
				replaceState: isAndroidTv
			});
		}
		return;
	}

	const playlist = await loadEntirePlaylist(playlistId);
	const playlistVideoIds = playlist.videos.map((value) => {
		return value.videoId;
	});

	let goToVideo: PlaylistPageVideo | undefined;

	const shufflePlaylist = get(playlistSettingsStore)[playlistId]?.shuffle ?? false;
	const loopPlaylist = get(playlistSettingsStore)[playlistId]?.loop ?? false;

	if (shufflePlaylist) {
		goToVideo = unsafeRandomItem(playlist.videos);
	} else {
		const currentVideoIndex = playlistVideoIds.indexOf(video.videoId);
		const newIndex = currentVideoIndex + 1;
		if (currentVideoIndex !== -1 && newIndex < playlistVideoIds.length) {
			goToVideo = playlist.videos[newIndex];
		} else if (loopPlaylist) {
			// Loop playlist on end
			goToVideo = playlist.videos[0];
		}
	}

	if (typeof goToVideo !== 'undefined') {
		get(syncPartyConnectionsStore)?.forEach((conn) => {
			if (typeof goToVideo === 'undefined') return;

			conn.send({
				events: [
					{ type: 'change-video', videoId: goToVideo.videoId },
					{ type: 'playlist', playlistId: playlistId }
				]
			} as PlayerEvents);
		});

		goto(resolve(`/${isAndroidTv ? 'tv' : 'watch'}/${goToVideo.videoId}?playlist=${playlistId}`), {
			replaceState: isAndroidTv
		});
	}
}
