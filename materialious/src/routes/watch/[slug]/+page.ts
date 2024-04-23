import {
	amSubscribed,
	getComments,
	getDislikes,
	getPersonalPlaylists,
	getVideo,
	postHistory
} from '$lib/Api/index.js';
import type { PlaylistPage } from '$lib/Api/model';
import { phaseDescription } from '$lib/misc';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { authStore, playerProxyVideosStore, returnYTDislikesInstanceStore, returnYtDislikesStore } from '../../../store';

export async function load({ params, url }) {
	let video;
	try {
		video = await getVideo(params.slug, get(playerProxyVideosStore));
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	let downloadOptions: { title: string; url: string; }[] = [];

	if (!video.hlsUrl) {
		video.formatStreams.forEach((format) => {
			downloadOptions.push({
				title: `${format.type.split(';')[0].trim()} - ${format.qualityLabel} (With audio)`,
				url: format.url
			});
		});

		video.adaptiveFormats.forEach((format) => {
			downloadOptions.push({
				title: `${format.type.split(';')[0].trim()} - ${format.qualityLabel || format.bitrate + ' bitrate'}`,
				url: format.url
			});
		});
	}

	let personalPlaylists: PlaylistPage[] | null;

	if (get(authStore)) {
		postHistory(video.videoId);
		personalPlaylists = await getPersonalPlaylists();
	} else {
		personalPlaylists = null;
	}

	let comments;
	try {
		comments = video.liveNow
			? null
			: await getComments(params.slug, { sort_by: 'top', source: 'youtube' });
	} catch {
		comments = null;
	}

	if (comments && 'errorBacktrace' in comments) {
		comments = null;
	}

	let returnYTDislikes = null;
	const returnYTDislikesInstance = get(returnYTDislikesInstanceStore);
	if (returnYTDislikesInstance && returnYTDislikesInstance !== "") {
		try {
			returnYTDislikes = get(returnYtDislikesStore) ? await getDislikes(params.slug) : null;
		} catch { }
	}

	return {
		video: video,
		returnYTDislikes: returnYTDislikes,
		comments: comments,
		subscribed: await amSubscribed(video.authorId),
		content: phaseDescription(video.descriptionHtml),
		playlistId: url.searchParams.get('playlist'),
		personalPlaylists: personalPlaylists,
		downloadOptions: downloadOptions
	};
}
