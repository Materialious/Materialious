import { get } from 'svelte/store';
import {
	auth,
	deArrowInstance,
	deArrowThumbnailInstance,
	returnYTDislikesInstance
} from '../../store';
import type {
	Channel,
	ChannelContentPlaylists,
	ChannelContentVideos,
	ChannelPage,
	Comments,
	DeArrow,
	Feed,
	Playlist,
	PlaylistPage,
	ReturnYTDislikes,
	SearchSuggestion,
	Subscription,
	Video,
	VideoPlay
} from './model';

export function buildPath(path: string): string {
	return `${import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE}/api/v1/${path}`;
}

export async function fetchErrorHandle(response: Response): Promise<Response> {
	if (!response.ok) {
		let message = 'Internal error';
		try {
			const json = await response.json();
			message = 'errorBacktrace' in json ? json.errorBacktrace : json.error;
		} catch { }
		throw Error(message);
	}

	return response;
}

export function buildAuthHeaders(): { headers: { Authorization: string; }; } {
	return { headers: { Authorization: `Bearer ${get(auth)?.token}` } };
}

export async function getTrending(): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(buildPath('trending')));
	return await resp.json();
}

export async function getPopular(): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(buildPath('popular')));
	return await resp.json();
}

export async function getVideo(videoId: string, local: boolean = false): Promise<VideoPlay> {
	const resp = await fetchErrorHandle(await fetch(buildPath(`videos/${videoId}?local=${local}`)));
	return await resp.json();
}

export async function getDislikes(videoId: string): Promise<ReturnYTDislikes> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(returnYTDislikesInstance)}/votes?videoId=${videoId}`)
	);
	return await resp.json();
}

export async function getComments(
	videoId: string,
	parameters: {
		sort_by?: 'top' | 'new';
		source?: 'youtube' | 'reddit';
		continuation?: string;
	}
): Promise<Comments> {
	if (typeof parameters.sort_by === 'undefined') {
		parameters.sort_by = 'top';
	}

	if (typeof parameters.source === 'undefined') {
		parameters.source = 'youtube';
	}

	const path = new URL(buildPath(`comments/${videoId}`));
	path.search = new URLSearchParams(parameters).toString();
	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}

export async function getChannel(channelId: string): Promise<ChannelPage> {
	const resp = await fetchErrorHandle(await fetch(buildPath(`channels/${channelId}`)));
	return await resp.json();
}

export async function getChannelContent(
	channelId: string,
	parameters: {
		type?: 'videos' | 'playlists' | 'streams' | 'shorts';
		continuation?: string;
	}
): Promise<ChannelContentVideos | ChannelContentPlaylists> {
	if (typeof parameters.type === 'undefined') parameters.type = 'videos';

	const url = new URL(buildPath(`channels/${channelId}/${parameters.type}`));

	if (typeof parameters.continuation !== 'undefined')
		url.searchParams.set('continuation', parameters.continuation);

	const resp = await fetchErrorHandle(await fetch(url.toString()));
	return await resp.json();
}

export async function getSearchSuggestions(search: string): Promise<SearchSuggestion> {
	const path = new URL(buildPath('search/suggestions'));
	path.search = new URLSearchParams({ q: search }).toString();
	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}

export async function getSearch(
	search: string,
	options: {
		sort_by?: 'relevance' | 'rating' | 'upload_date' | 'view_count';
		type?: 'video' | 'playlist' | 'channel' | 'all';
		page?: string;
	}
): Promise<(Channel | Video | Playlist)[]> {
	if (typeof options.sort_by === 'undefined') {
		options.sort_by = 'relevance';
	}

	if (typeof options.type === 'undefined') {
		options.type = 'video';
	}

	if (typeof options.page === 'undefined') {
		options.page = '1';
	}

	const path = new URL(buildPath('search'));
	path.search = new URLSearchParams({ ...options, q: search }).toString();
	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}

export async function getFeed(maxResults: number, page: number): Promise<Feed> {
	const path = new URL(buildPath('auth/feed'));
	path.search = new URLSearchParams({
		max_results: maxResults.toString(),
		page: page.toString()
	}).toString();
	const resp = await fetchErrorHandle(await fetch(path, buildAuthHeaders()));
	return await resp.json();
}

export async function getSubscriptions(): Promise<Subscription[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/subscriptions'), buildAuthHeaders())
	);
	return await resp.json();
}

export async function amSubscribed(authorId: string): Promise<boolean> {
	try {
		const subscriptions = (await getSubscriptions()).filter((sub) => sub.authorId === authorId);
		return subscriptions.length === 1;
	} catch {
		return false;
	}
}

export async function postSubscribe(authorId: string) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'POST',
			...buildAuthHeaders()
		})
	);
}

export async function deleteUnsubscribe(authorId: string) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}

export async function getHistory(page: number = 1, maxResults: number = 20): Promise<string[]> {
	const resp = await fetchErrorHandle(
		await fetch(buildPath(`auth/history?page=${page}&max_results=${maxResults}`), buildAuthHeaders())
	);
	return await resp.json();
}

export async function deleteHistory(videoId: string | undefined = undefined) {
	let url = '/api/v1/auth/history';
	if (typeof videoId !== 'undefined') {
		url += `/${videoId}`;
	}

	await fetchErrorHandle(
		await fetch(buildPath(url), {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}

export async function postHistory(videoId: string) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/history/${videoId}`), {
			method: 'POST',
			...buildAuthHeaders()
		})
	);
}

export async function getPlaylist(playlistId: string, page: number = 1): Promise<PlaylistPage> {
	let resp;

	if (get(auth)) {
		resp = await fetch(buildPath(`auth/playlists/${playlistId}?page=${page}`), buildAuthHeaders());
	} else {
		resp = await fetch(buildPath(`playlists/${playlistId}?page=${page}`));
	}
	await fetchErrorHandle(resp);
	return await resp.json();
}

export async function getPersonalPlaylists(): Promise<PlaylistPage[]> {
	const resp = await fetchErrorHandle(await fetch(buildPath('auth/playlists'), buildAuthHeaders()));
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
	privacy: 'public' | 'private' | 'unlisted'
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
			...headers
		})
	);
}

export async function addPlaylistVideo(playlistId: string, videoId: string) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}/videos`), {
			method: 'POST',
			body: JSON.stringify({
				videoId: videoId
			}),
			...headers
		})
	);
}

export async function removePlaylistVideo(playlistId: string, indexId: string) {
	await fetchErrorHandle(
		await fetch(buildPath(`auth/playlists/${playlistId}/videos/${indexId}`), {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}

export async function getDeArrow(videoId: string): Promise<DeArrow> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(deArrowInstance)}/api/branding?videoID=${videoId}`)
	);
	return await resp.json();
}

export async function getThumbnail(videoId: string, time: number): Promise<string> {
	const resp = await fetchErrorHandle(
		await fetch(
			`${get(deArrowThumbnailInstance)}/api/v1/getThumbnail?videoID=${videoId}&time=${time}`
		)
	);
	return URL.createObjectURL(await resp.blob());
}
