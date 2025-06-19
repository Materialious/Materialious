import { patchYoutubeJs } from '$lib/patches/youtubejs';
import { Capacitor } from '@capacitor/core';
import { get } from 'svelte/store';
import {
	authStore,
	deArrowInstanceStore,
	deArrowThumbnailInstanceStore,
	instanceStore,
	interfaceRegionStore,
	playerYouTubeJsAlways,
	playerYouTubeJsFallback,
	returnYTDislikesInstanceStore,
	synciousInstanceStore
} from '../store';
import type {
	Channel,
	ChannelContentPlaylists,
	ChannelContentVideos,
	ChannelPage,
	Comments,
	DeArrow,
	Feed,
	HashTag,
	Playlist,
	PlaylistPage,
	ResolvedUrl,
	ReturnYTDislikes,
	SearchSuggestion,
	Subscription,
	SynciousProgressModel,
	Video,
	VideoPlay
} from './model';

export function buildPath(path: string): URL {
	return new URL(`${get(instanceStore)}/api/v1/${path}`);
}

export function setRegion(url: URL): URL {
	const region = get(interfaceRegionStore);

	if (region) {
		url.searchParams.set('region', region);
	}

	return url;
}

export async function fetchErrorHandle(response: Response): Promise<Response> {
	if (!response.ok) {
		let message = 'Internal error';
		try {
			const json = await response.json();
			message = 'errorBacktrace' in json ? json.errorBacktrace : json.error;
		} catch {}
		throw Error(message);
	}

	return response;
}

export function buildAuthHeaders(): { headers: Record<string, string> } {
	const authToken = get(authStore)?.token ?? '';
	if (authToken.startsWith('SID=')) {
		return { headers: { __sid_auth: authToken } };
	} else {
		return { headers: { Authorization: `Bearer ${get(authStore)?.token}` } };
	}
}

export async function getTrending(fetchOptions?: RequestInit): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(setRegion(buildPath('trending')), fetchOptions));
	return await resp.json();
}

export async function getPopular(fetchOptions?: RequestInit): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(buildPath('popular'), fetchOptions));
	return await resp.json();
}

export async function getResolveUrl(url: string): Promise<ResolvedUrl> {
	const resp = await fetchErrorHandle(await fetch(`${buildPath('resolveurl')}?url=${url}`));
	return await resp.json();
}

export async function getVideo(
	videoId: string,
	local: boolean = false,
	fetchOptions?: RequestInit
): Promise<VideoPlay> {
	if (get(playerYouTubeJsAlways) && Capacitor.isNativePlatform()) {
		return await patchYoutubeJs(videoId);
	}

	const resp = await fetch(setRegion(buildPath(`videos/${videoId}?local=${local}`)), fetchOptions);

	if (!resp.ok && get(playerYouTubeJsFallback) && Capacitor.isNativePlatform()) {
		return await patchYoutubeJs(videoId);
	} else {
		await fetchErrorHandle(resp);
	}
	return await resp.json();
}

export async function getDislikes(
	videoId: string,
	fetchOptions?: RequestInit
): Promise<ReturnYTDislikes> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(returnYTDislikesInstanceStore)}/votes?videoId=${videoId}`, fetchOptions)
	);
	return await resp.json();
}

export async function getComments(
	videoId: string,
	parameters: {
		sort_by?: 'top' | 'new';
		source?: 'youtube' | 'reddit';
		continuation?: string;
	},
	fetchOptions?: RequestInit
): Promise<Comments> {
	if (typeof parameters.sort_by === 'undefined') {
		parameters.sort_by = 'top';
	}

	if (typeof parameters.source === 'undefined') {
		parameters.source = 'youtube';
	}

	const path = buildPath(`comments/${videoId}`);
	path.search = new URLSearchParams(parameters).toString();
	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}

export async function getChannel(
	channelId: string,
	fetchOptions?: RequestInit
): Promise<ChannelPage> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath(`channels/${channelId}`), fetchOptions)
	);
	return await resp.json();
}

export async function getChannelContent(
	channelId: string,
	parameters: {
		type?: 'videos' | 'playlists' | 'streams' | 'shorts';
		continuation?: string;
	},
	fetchOptions?: RequestInit
): Promise<ChannelContentVideos | ChannelContentPlaylists> {
	if (typeof parameters.type === 'undefined') parameters.type = 'videos';

	const url = buildPath(`channels/${channelId}/${parameters.type}`);

	if (typeof parameters.continuation !== 'undefined')
		url.searchParams.set('continuation', parameters.continuation);

	const resp = await fetchErrorHandle(await fetch(url.toString(), fetchOptions));
	return await resp.json();
}

export async function getSearchSuggestions(
	search: string,
	fetchOptions?: RequestInit
): Promise<SearchSuggestion> {
	const path = buildPath('search/suggestions');
	path.search = new URLSearchParams({ q: search }).toString();
	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}

export async function getHashtag(tag: string, page: number = 0): Promise<{ results: Video[] }> {
	const resp = await fetchErrorHandle(await fetch(buildPath(`hashtag/${tag}?page=${page}`)));
	return await resp.json();
}

export async function getSearch(
	search: string,
	options: {
		sort_by?: 'relevance' | 'rating' | 'upload_date' | 'view_count';
		type?: 'video' | 'playlist' | 'channel' | 'all';
		page?: string;
	},
	fetchOptions?: RequestInit
): Promise<(Channel | Video | Playlist | HashTag)[]> {
	if (typeof options.sort_by === 'undefined') {
		options.sort_by = 'relevance';
	}

	if (typeof options.type === 'undefined') {
		options.type = 'video';
	}

	if (typeof options.page === 'undefined') {
		options.page = '1';
	}

	const path = buildPath('search');
	path.search = new URLSearchParams({ ...options, q: search }).toString();
	const resp = await fetchErrorHandle(await fetch(setRegion(path), fetchOptions));
	return await resp.json();
}

export async function getFeed(
	maxResults: number,
	page: number,
	fetchOptions: RequestInit = {}
): Promise<Feed> {
	const path = buildPath('auth/feed');
	path.search = new URLSearchParams({
		max_results: maxResults.toString(),
		page: page.toString()
	}).toString();
	const resp = await fetchErrorHandle(
		await fetch(path, { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function getSubscriptions(fetchOptions: RequestInit = {}): Promise<Subscription[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/subscriptions'), { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function amSubscribed(
	authorId: string,
	fetchOptions: RequestInit = {}
): Promise<boolean> {
	if (!get(authStore)) return false;

	try {
		const subscriptions = (await getSubscriptions(fetchOptions)).filter(
			(sub) => sub.authorId === authorId
		);
		return subscriptions.length === 1;
	} catch {
		return false;
	}
}

export async function postSubscribe(authorId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'POST',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function deleteUnsubscribe(authorId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function getHistory(
	page: number = 1,
	maxResults: number = 20,
	fetchOptions: RequestInit = {}
): Promise<string[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath(`auth/history?page=${page}&max_results=${maxResults}`), {
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
	return await resp.json();
}

export async function deleteHistory(
	videoId: string | undefined = undefined,
	fetchOptions: RequestInit = {}
) {
	let url = '/api/v1/auth/history';
	if (typeof videoId !== 'undefined') {
		url += `/${videoId}`;
	}

	await fetchErrorHandle(
		await fetch(buildPath(url), {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function postHistory(videoId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/history/${videoId}`), {
			method: 'POST',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function getPlaylist(
	playlistId: string,
	page: number = 1,
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage> {
	let resp;

	if (get(authStore)) {
		resp = await fetch(buildPath(`auth/playlists/${playlistId}?page=${page}`), {
			...buildAuthHeaders(),
			...fetchOptions
		});
	} else {
		resp = await fetch(buildPath(`playlists/${playlistId}?page=${page}`), fetchOptions);
	}
	await fetchErrorHandle(resp);
	return await resp.json();
}

export async function getPersonalPlaylists(
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/playlists'), { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function deletePersonalPlaylist(playlistId: string) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}`), {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}

export async function postPersonalPlaylist(
	title: string,
	privacy: 'public' | 'private' | 'unlisted',
	fetchOptions: RequestInit = {}
) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(buildPath('auth/playlists'), {
			method: 'POST',
			body: JSON.stringify({
				title: title,
				privacy: privacy
			}),
			...headers,
			...fetchOptions
		})
	);
}

export async function addPlaylistVideo(
	playlistId: string,
	videoId: string,
	fetchOptions: RequestInit = {}
) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}/videos`), {
			method: 'POST',
			body: JSON.stringify({
				videoId: videoId
			}),
			...headers,
			...fetchOptions
		})
	);
}

export async function removePlaylistVideo(
	playlistId: string,
	indexId: string,
	fetchOptions: RequestInit = {}
) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}/videos/${indexId}`), {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function getDeArrow(videoId: string, fetchOptions?: RequestInit): Promise<DeArrow> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(deArrowInstanceStore)}/api/branding?videoID=${videoId}`, fetchOptions)
	);
	return await resp.json();
}

export async function getThumbnail(
	videoId: string,
	time: number,
	fetchOptions?: RequestInit
): Promise<string> {
	const resp = await fetchErrorHandle(
		await fetch(
			`${get(deArrowThumbnailInstanceStore)}/api/v1/getThumbnail?videoID=${videoId}&time=${time}`,
			fetchOptions
		)
	);
	return URL.createObjectURL(await resp.blob());
}

export async function getVideoProgress(
	videoId: string,
	fetchOptions: RequestInit = {}
): Promise<SynciousProgressModel[]> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/video/${encodeURIComponent(videoId)}`, {
			...buildAuthHeaders(),
			...fetchOptions
		})
	);

	return resp.json();
}

export async function saveVideoProgress(
	videoId: string,
	time: number,
	fetchOptions: RequestInit = {}
) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/video/${encodeURIComponent(videoId)}`, {
			...headers,
			method: 'POST',
			body: JSON.stringify({
				time: time
			}),
			...fetchOptions
		})
	);
}

export async function deleteVideoProgress(videoId: string, fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/video/${videoId}`, {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function deleteAllVideoProgress(fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/videos`, {
			method: 'DELETE',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}
