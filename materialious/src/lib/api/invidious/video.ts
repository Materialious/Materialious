import { get } from 'svelte/store';
import type { VideoPlay } from '../model';
import { buildPath, fetchErrorHandle } from './request';
import { getVideoYTjs } from '../youtubejs/video';
import { playerYouTubeJsFallback } from '$lib/store';
import { isUnrestrictedPlatform } from '$lib/misc';
import { associateAvatar } from '$lib/thumbnail';

export async function getVideoInvidious(
	videoId: string,
	local: boolean = false,
	fetchOptions?: RequestInit
): Promise<VideoPlay> {
	const path = buildPath(`videos/${videoId}`);
	path.searchParams.set('local', local.toString());

	const resp = await fetch(path, fetchOptions);

	if (!resp.ok && get(playerYouTubeJsFallback) && isUnrestrictedPlatform()) {
		return await getVideoYTjs(videoId);
	} else {
		await fetchErrorHandle(resp);
	}

	const respJson = await resp.json();

	if (resp.ok) {
		associateAvatar(respJson.authorId, respJson.authorThumbnails);
	}

	return respJson;
}
