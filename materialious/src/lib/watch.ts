import { getComments, getPersonalPlaylists, getVideo, saveWatchHistory } from '$lib/api/index';
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

export async function getWatchDetails(videoId: string, url: URL) {
	const playerStateRetrieved = get(playerState);

	let video: VideoPlay;

	if (playerStateRetrieved && playerStateRetrieved.data.video.videoId === videoId) {
		video = playerStateRetrieved.data.video;
	} else {
		try {
			video = await getVideo(videoId, get(playerProxyVideosStore), { priority: 'high' });
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}
	}

	let personalPlaylists;
	if (get(invidiousAuthStore)) {
		personalPlaylists = getPersonalPlaylists({ priority: 'low' });
	} else {
		personalPlaylists = null;
	}

	saveWatchHistory(video);

	let comments;
	try {
		comments = video.liveNow ? null : getComments(videoId, { sort_by: 'top' }, { priority: 'low' });
	} catch {
		comments = null;
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

	const playlistId = url.searchParams.get('playlist');
	if (playlistId) {
		await loadEntirePlaylist(playlistId);
	}

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

	return {
		video: video,
		content: parseDescription(video.videoId, video.descriptionHtml, video.fallbackPatch),
		playlistId: playlistId,
		streamed: {
			personalPlaylists: personalPlaylists,
			returnYTDislikes: returnYTDislikes,
			comments: comments
		}
	};
}
