import {
	amSubscribed,
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
	returnYTDislikesInstanceStore,
	returnYtDislikesStore
} from '$lib/store';
import { phaseDescription } from '$lib/timestamps';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { _ } from './i18n';

export async function getWatchDetails(videoId: string, url: URL) {
	let video;
	try {
		video = await getVideo(videoId, get(playerProxyVideosStore), { priority: 'high' });
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	if (video.premium) {
		error(400, get(_)('premium'));
	}

	if (video.isUpcoming) {
		error(400, get(_)('isUpcoming'));
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
		} catch {}
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
			comments: comments,
			subscribed: amSubscribed(video.authorId)
		}
	};
}
