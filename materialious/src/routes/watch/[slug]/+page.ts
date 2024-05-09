import {
	amSubscribed,
	getComments,
	getDislikes,
	getPersonalPlaylists,
	getVideo,
	postHistory
} from '$lib/Api/index.js';
import { phaseDescription } from '$lib/misc';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import {
	authStore,
	playerProxyVideosStore,
	returnYTDislikesInstanceStore,
	returnYtDislikesStore
} from '../../../store';

export async function load({ params, url }) {
	let video;
	try {
		video = await getVideo(params.slug, get(playerProxyVideosStore));
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	let downloadOptions: { title: string; url: string; container: string | undefined; }[] = [];

	if (!video.hlsUrl) {
		video.formatStreams.forEach((format) => {
			downloadOptions.push({
				title: `${format.type.split(';')[0].trim()} - ${format.qualityLabel} (With audio)`,
				url: format.url,
				container: format.container
			});
		});

		video.adaptiveFormats.forEach((format) => {
			downloadOptions.push({
				title: `${format.type.split(';')[0].trim()} - ${format.qualityLabel || format.bitrate + ' bitrate'}`,
				url: format.url,
				container: format.container
			});
		});
	}

	let personalPlaylists;
	if (get(authStore)) {
		postHistory(video.videoId);
		personalPlaylists = getPersonalPlaylists();
	} else {
		personalPlaylists = null;
	}

	let comments;
	try {
		comments = video.liveNow
			? null
			: getComments(params.slug, { sort_by: 'top', source: 'youtube' });
	} catch {
		comments = null;
	}

	let returnYTDislikes = null;
	const returnYTDislikesInstance = get(returnYTDislikesInstanceStore);
	if (returnYTDislikesInstance && returnYTDislikesInstance !== '') {
		try {
			returnYTDislikes = get(returnYtDislikesStore) ? getDislikes(params.slug) : null;
		} catch { }
	}

	return {
		video: video,
		content: phaseDescription(video.descriptionHtml),
		playlistId: url.searchParams.get('playlist'),
		downloadOptions: downloadOptions,
		streamed: {
			personalPlaylists: personalPlaylists,
			returnYTDislikes: returnYTDislikes,
			comments: comments,
			subscribed: amSubscribed(video.authorId)
		}
	};
}
