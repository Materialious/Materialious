import {
	amSubscribed,
	getComments,
	getDislikes,
	getPersonalPlaylists,
	getVideo,
	postHistory
} from '$lib/Api/index.js';
import { phaseDescription } from '$lib/misc';
import {
	authStore,
	playerProxyVideosStore,
	returnYTDislikesInstanceStore,
	returnYtDislikesStore
} from '$lib/store';
import { listCombinedQualities } from '$lib/videoDownload';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load({ params, url }) {
	let video;
	try {
		video = await getVideo(params.slug, get(playerProxyVideosStore), { priority: "high" });
	} catch (errorMessage: any) {
		error(500, errorMessage);
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
			: getComments(params.slug, { sort_by: 'top', source: 'youtube' }, { priority: "low" });
	} catch {
		comments = null;
	}

	let returnYTDislikes;
	const returnYTDislikesInstance = get(returnYTDislikesInstanceStore);
	if (returnYTDislikesInstance && returnYTDislikesInstance !== '') {
		try {
			returnYTDislikes = get(returnYtDislikesStore) ? getDislikes(params.slug, { priority: "low" }) : null;
		} catch { }
	}


	let downloadQualitiesDash;
	if (
		import.meta.env.VITE_DEFAULT_DOWNLOAD_ENABLED &&
		import.meta.env.VITE_DEFAULT_DOWNLOAD_ENABLED.toString().toLowerCase() === 'true' &&
		!video.liveNow
	) {
		downloadQualitiesDash = listCombinedQualities(video.dashUrl);
	}

	return {
		video: video,
		content: phaseDescription(video.descriptionHtml),
		playlistId: url.searchParams.get('playlist'),
		streamed: {
			personalPlaylists: personalPlaylists,
			returnYTDislikes: returnYTDislikes,
			comments: comments,
			subscribed: amSubscribed(video.authorId),
			downloadQualitiesDash: downloadQualitiesDash
		}
	};
}
