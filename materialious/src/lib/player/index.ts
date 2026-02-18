import { get } from 'svelte/store';
import type { PlaylistPageVideo, VideoPlay } from '$lib/api/model';
import {
	isAndroidTvStore,
	playerAutoplayNextByDefaultStore,
	playerDefaultLanguage,
	playerDefaultQualityStore,
	playerPlaylistHistory,
	playerState,
	playlistSettingsStore,
	syncPartyConnectionsStore
} from '$lib/store';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { loadEntirePlaylist } from '$lib/playlist';
import { unsafeRandomItem } from '$lib/misc';
import type shaka from 'shaka-player/dist/shaka-player.ui';
import ISO6391 from 'iso-639-1';

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

export const playbackRates = [
	0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4
];
export const playerDoubleTapSeek = 10.0;

export function goToPreviousVideo(playlistId: string | null) {
	const previousVideos = get(playerPlaylistHistory);
	if (previousVideos.length > 1) {
		playerState.set(undefined);

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
			goto(
				resolve(`/${isAndroidTv ? 'tv' : 'watch'}/[videoId]`, {
					videoId: video.recommendedVideos[0].videoId
				}),
				{
					replaceState: isAndroidTv
				}
			);
		}
		return;
	}

	playerState.set(undefined);

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

		goto(
			resolve(`/${isAndroidTv ? 'tv' : 'watch'}/[videoId]?playlist=${playlistId}`, {
				videoId: goToVideo.videoId
			}),
			{
				replaceState: isAndroidTv
			}
		);
	}
}

export function restoreQualityPreference(player: shaka.Player) {
	const numericValue = parseInt(get(playerDefaultQualityStore), 10);

	if (isNaN(numericValue)) {
		player.configure({ abr: { enabled: true } });
		return;
	}

	// Get video-only variant tracks
	const tracks = player.getVariantTracks().filter((t) => t.height !== null);

	// Sort by resolution descending
	const sortedTracks = tracks.sort((a, b) => (b.height as number) - (a.height as number));

	// Try exact match
	let selectedTrack = sortedTracks.find((t) => t.height === numericValue);

	// Try next best (lower than target)
	if (!selectedTrack) {
		selectedTrack = sortedTracks.find((t) => (t.height as number) < numericValue);
	}

	// Try next higher
	if (!selectedTrack) {
		selectedTrack = sortedTracks.find((t) => (t.height as number) > numericValue);
	}

	if (selectedTrack) {
		player.configure({ abr: { enabled: false } });
		player.selectVariantTrack(selectedTrack, true);
	} else {
		player.configure({ abr: { enabled: true } });
	}
}

export function restoreDefaultLanguage(player: shaka.Player) {
	if (!get(playerDefaultLanguage) || get(playerDefaultLanguage) === 'original') {
		const languageAndRole = player.getAudioLanguagesAndRoles().find(({ role }) => role === 'main');
		if (languageAndRole !== undefined) {
			player.selectAudioLanguage(languageAndRole.language);
			return;
		}
	} else if (get(playerDefaultLanguage)) {
		const audioLanguages = player.getAudioLanguages();
		const langCode = ISO6391.getCode(get(playerDefaultLanguage));

		for (const audioLanguage of audioLanguages) {
			if (audioLanguage.startsWith(langCode)) {
				player.selectAudioLanguage(audioLanguage);
				break;
			}
		}
	}
}

export function toggleSubtitles(player: shaka.Player) {
	const isVisible = player.isTextTrackVisible();
	if (isVisible) {
		player.setTextTrackVisibility(false);
	} else {
		let langCode: string;
		if (get(playerDefaultLanguage) === 'original') {
			const languageAndRole = player
				.getAudioLanguagesAndRoles()
				.find(({ role }) => role === 'main');

			if (!languageAndRole) {
				return;
			}

			langCode = languageAndRole.language;
		} else {
			const defaultLanguage = get(playerDefaultLanguage);
			langCode = ISO6391.getCode(defaultLanguage);
		}

		const tracks = player.getTextTracks();

		const subtitleTrack = tracks.find((track) => track.language === langCode);

		if (subtitleTrack) {
			player.selectTextTrack(subtitleTrack);
			player.setTextTrackVisibility(true);
		}
	}
}
