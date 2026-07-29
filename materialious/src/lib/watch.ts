import { getComments, getPersonalPlaylists, getVideoPage, continueVideoPlayer, saveWatchHistory } from '$lib/api/index';
import { loadEntirePlaylist } from '$lib/playlist';
import {
	deArrowEnabledStore,
	invidiousAuthStore,
	playerProxyVideosStore,
	playerState,
	returnYTDislikesInstanceStore,
	returnYtDislikesStore
} from '$lib/store';
import { parseDescription } from '$lib/description';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { getDislikesRYD } from './api/ytd';
import { getDeArrow } from './api/dearrow';
import type { VideoPlay } from './api/model';

export async function getWatchPage(videoId: string, url: URL) {
	const playerStateRetrieved = get(playerState);

	let video: VideoPlay;

	if (playerStateRetrieved && playerStateRetrieved.data.video.videoId === videoId) {
		video = playerStateRetrieved.data.video;
	} else {
		try {
			video = await getVideoPage(videoId, get(playerProxyVideosStore), { priority: 'high' });
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}
	}

	saveWatchHistory(video);

	if (get(deArrowEnabledStore)) {
		try {
			const deArrow = await getDeArrow(videoId, { priority: 'low' });
			for (const title of deArrow.titles) {
				if (title.locked || title.votes > 0 || !title.original) {
					video = {
						...video,
						title: title.title.replace('>', '')
					};
					break;
				}
			}
		} catch {
			// Continue regardless of error.
		}
	}

	let comments;
	try {
		comments = video.liveNow ? null : getComments(videoId, { sort_by: 'top' }, { priority: 'low' });
	} catch {
		comments = null;
	}

	return {
		video: video,
		content: parseDescription(video.videoId, video.descriptionHtml, video.fallbackPatch),
		playlistId: url.searchParams.get('playlist'),
		streamed: {
			comments: comments
		}
	};
}

export async function getWatchPlayer(videoId: string, url: URL) {
	const playlistId = url.searchParams.get('playlist');

	if (playlistId) {
		await loadEntirePlaylist(playlistId);
	}

	let personalPlaylists;
	if (get(invidiousAuthStore)) {
		personalPlaylists = getPersonalPlaylists({ priority: 'low' });
	} else {
		personalPlaylists = null;
	}

	let returnYTDislikes;
	const returnYTDislikesInstance = get(returnYTDislikesInstanceStore);
	if (returnYTDislikesInstance && returnYTDislikesInstance !== '') {
		try {
			returnYTDislikes = get(returnYtDislikesStore)
				? getDislikesRYD(videoId, { priority: 'low' })
				: null;
		} catch {
			// Continue regardless of error
		}
	}

	const playerData = await continueVideoPlayer(videoId);

	return {
		playerData,
		personalPlaylists,
		returnYTDislikes,
		playlistId
	};
}

export async function getWatchDetails(videoId: string, url: URL) {
	const page = await getWatchPage(videoId, url);
	const player = await getWatchPlayer(videoId, url);

	if (player.playerData) {
		page.video.dashUrl = player.playerData.dashUrl ?? page.video.dashUrl;
		page.video.adaptiveFormats = player.playerData.adaptiveFormats;
		page.video.captions = player.playerData.captions;
		page.video.hlsUrl = player.playerData.hlsUrl ?? page.video.hlsUrl;
		page.video.ytjs = player.playerData.ytjs;
	}

	return {
		video: page.video,
		content: page.content,
		playlistId: page.playlistId,
		streamed: {
			personalPlaylists: player.personalPlaylists,
			returnYTDislikes: player.returnYTDislikes,
			comments: page.streamed.comments
		}
	};
}
