import {
	getComments,
	getDislikes,
	getPersonalPlaylists,
	getVideo,
	postHistory
} from '$lib/api/index';
import { loadEntirePlaylist } from '$lib/playlist';
import {
	authStore,
	playerProxyVideosStore,
	playerState,
	returnYTDislikesInstanceStore,
	returnYtDislikesStore
} from '$lib/store';
import { phaseDescription } from '$lib/timestamps';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { _ } from './i18n';

export async function getWatchDetails(videoId: string, url: URL) {
	const playerStateRetrieved = get(playerState);

	let video;

	if (playerStateRetrieved && playerStateRetrieved.data.video.videoId === videoId) {
		video = playerStateRetrieved.data.video;
	} else {
		try {
			video = await getVideo(videoId, get(playerProxyVideosStore), { priority: 'high' });
		} catch (errorMessage: any) {
			error(500, errorMessage);
		}
	}

	if (video.premium) {
		error(400, get(_)('premium'));
	}

	let personalPlaylists;
	if (get(authStore)) {
		postHistory(video.videoId);
		personalPlaylists = getPersonalPlaylists({ priority: 'low' });
	} else {
		personalPlaylists = null;
	}

	let comments;
	try {
		comments = video.liveNow
			? null
			: getComments(videoId, { sort_by: 'top', source: 'youtube' }, { priority: 'low' });
	} catch {
		comments = null;
	}

	let returnYTDislikes;
	const returnYTDislikesInstance = get(returnYTDislikesInstanceStore);
	if (returnYTDislikesInstance && returnYTDislikesInstance !== '') {
		try {
			returnYTDislikes = get(returnYtDislikesStore)
				? getDislikes(videoId, { priority: 'low' })
				: null;
		} catch {
			// Continue regardless of error
		}
	}

	const playlistId = url.searchParams.get('playlist');
	if (playlistId) {
		await loadEntirePlaylist(playlistId);
	}

	return {
		video: video,
		content: phaseDescription(video.videoId, video.descriptionHtml, video.fallbackPatch),
		playlistId: playlistId,
		streamed: {
			personalPlaylists: personalPlaylists,
			returnYTDislikes: returnYTDislikes,
			comments: comments
		}
	};
}
