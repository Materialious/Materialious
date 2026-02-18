import { getVideoYTjs } from '$lib/api/youtubejs/video';
import { get } from 'svelte/store';
import {
	invidiousAuthStore,
	deArrowInstanceStore,
	deArrowThumbnailInstanceStore,
	invidiousInstanceStore,
	interfaceRegionStore,
	playerYouTubeJsAlways,
	playerYouTubeJsFallback,
	rawMasterKeyStore,
	returnYTDislikesInstanceStore,
	synciousInstanceStore
} from '../store';
import type {
	ChannelPage,
	Comments,
	DeArrow,
	Feed,
	PlaylistPage,
	ResolvedUrl,
	ReturnYTDislikes,
	SearchSuggestion,
	Subscription,
	ApiExntendedProgressModel,
	Video,
	VideoPlay,
	SearchOptions,
	SearchResults,
	CommentsOptions,
	ChannelOptions,
	ChannelContent
} from './model';
import { commentsSetDefaults, searchSetDefaults, useEngineFallback } from './misc';
import { getSearchYTjs } from './youtubejs/search';
import { isUnrestrictedPlatform, isYTBackend } from '$lib/misc';
import { getSearchSuggestionsYTjs } from './youtubejs/searchSuggestions';
import { getResolveUrlYTjs } from './youtubejs/misc';
import { getCommentsYTjs } from './youtubejs/comments';
import { getChannelContentYTjs, getChannelYTjs } from './youtubejs/channel';
import {
	amSubscribedYTjs,
	deleteUnsubscribeYTjs,
	getFeedYTjs,
	getSubscriptionsYTjs,
	postSubscribeYTjs
} from './youtubejs/subscriptions';
import { getPlaylistYTjs } from './youtubejs/playlist';
import { isOwnBackend } from '$lib/shared';
import {
	amSubscribedBackend,
	deleteUnsubscribeBackend,
	getSubscriptionsBackend,
	postSubscribeBackend
} from './backend';
import { getUserLocale } from '$lib/i18n';

export function buildPath(path: string): URL {
	return setLocale(new URL(`${get(invidiousInstanceStore)}/api/v1/${path}`));
}

export function setLocale(url: URL): URL {
	const region = get(interfaceRegionStore);

	if (region) {
		url.searchParams.set('region', region);
	}

	const locale = getUserLocale();

	url.searchParams.set('hl', locale);

	return url;
}

export class HTTPError {
	msg: string;
	response: Response;

	constructor(msg: string, response: Response) {
		this.msg = msg;
		this.response = response;
	}

	toString() {
		return this.msg;
	}
}

export async function fetchErrorHandle(response: Response): Promise<Response> {
	if (!response.ok) {
		let message = 'Internal error';

		// Attempt to parse error.
		try {
			const json = await response.json();
			message = json.errorBacktrace || json.error || json.message;
		} catch {
			// Continue regardless of error
		}

		throw new HTTPError(
			`${response.status} - ${response.statusText}\n${decodeURIComponent(response.url)}\n${message}`,
			response
		);
	}

	return response;
}

export function buildAuthHeaders(): { headers: Record<string, string> } {
	const authToken = get(invidiousAuthStore)?.token ?? '';
	if (authToken.startsWith('SID=')) {
		return { headers: { __sid_auth: authToken } };
	} else {
		return { headers: { Authorization: `Bearer ${authToken}` } };
	}
}

export async function getPopular(fetchOptions?: RequestInit): Promise<Video[]> {
	// Doesn't exist in YTjs.
	if (isYTBackend()) {
		return [];
	}

	const resp = await fetchErrorHandle(await fetch(buildPath('popular'), fetchOptions));
	return await resp.json();
}

export async function getResolveUrl(url: string): Promise<ResolvedUrl> {
	if (isYTBackend() || useEngineFallback('ResolveUrl')) {
		return await getResolveUrlYTjs(url);
	}

	const path = buildPath('resolveurl');
	path.searchParams.set('url', url);

	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}

export async function getVideo(
	videoId: string,
	local: boolean = false,
	fetchOptions?: RequestInit
): Promise<VideoPlay> {
	if (
		(get(playerYouTubeJsAlways) && isUnrestrictedPlatform()) ||
		isYTBackend() ||
		useEngineFallback('Video')
	) {
		return await getVideoYTjs(videoId);
	}

	const path = buildPath(`videos/${videoId}`);
	path.searchParams.set('local', local.toString());

	const resp = await fetch(path, fetchOptions);

	if (!resp.ok && get(playerYouTubeJsFallback) && isUnrestrictedPlatform()) {
		return await getVideoYTjs(videoId);
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
	options: CommentsOptions,
	fetchOptions?: RequestInit
): Promise<Comments> {
	commentsSetDefaults(options);

	if (isYTBackend() || useEngineFallback('Comments')) {
		return await getCommentsYTjs(videoId, options);
	}

	const path = buildPath(`comments/${videoId}`);
	if (options.continuation) path.searchParams.set('continuation', options.continuation);
	if (options.sort_by) path.searchParams.set('sort_by', options.sort_by);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}

export async function getChannel(
	channelId: string,
	fetchOptions?: RequestInit
): Promise<ChannelPage> {
	if (isYTBackend() || useEngineFallback('Channel')) {
		return getChannelYTjs(channelId);
	}
	const resp = await fetchErrorHandle(
		await fetch(buildPath(`channels/${channelId}`), fetchOptions)
	);
	return await resp.json();
}

export async function getChannelContent(
	channelId: string,
	options: ChannelOptions,
	fetchOptions?: RequestInit
): Promise<ChannelContent> {
	if (typeof options.type === 'undefined') options.type = 'videos';

	if (isYTBackend() || useEngineFallback('ChannelContent')) {
		return await getChannelContentYTjs(channelId, options);
	}

	const url = buildPath(`channels/${channelId}/${options.type}`);

	if (typeof options.continuation !== 'undefined')
		url.searchParams.set('continuation', options.continuation);

	if (typeof options.sortBy !== 'undefined') url.searchParams.set('sort_by', options.sortBy);

	const resp = await fetchErrorHandle(await fetch(url.toString(), fetchOptions));
	return await resp.json();
}

export async function searchChannelContent(
	channelId: string,
	search: string,
	fetchOptions?: RequestInit
): Promise<ChannelContent> {
	// Not Implemented in YTjs
	if (isYTBackend()) {
		return {
			videos: []
		};
	}

	const path = buildPath(`channel/${channelId}/search`);
	path.searchParams.set('q', search);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}

export async function getSearchSuggestions(
	search: string,
	fetchOptions?: RequestInit
): Promise<SearchSuggestion> {
	if (isYTBackend() || useEngineFallback('SearchSuggestions')) {
		return getSearchSuggestionsYTjs(search);
	}

	const path = buildPath('search/suggestions');
	path.searchParams.set('q', search);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}

export async function getHashtag(tag: string, page: number = 0): Promise<{ results: Video[] }> {
	// TODO: Implement in YTjs
	if (isYTBackend()) return { results: [] };

	const path = buildPath(`hashtag/${tag}`);
	path.searchParams.set('page', page.toString());

	const resp = await fetchErrorHandle(await fetch(path));
	return await resp.json();
}

export async function getSearch(
	search: string,
	options: SearchOptions,
	fetchOptions?: RequestInit
): Promise<SearchResults> {
	searchSetDefaults(options);

	if (isYTBackend() || useEngineFallback('Search')) {
		return await getSearchYTjs(search, options);
	}

	const path = buildPath('search');
	path.searchParams.set('q', search);

	if (options.date) path.searchParams.set('date', options.date);
	if (options.duration) path.searchParams.set('duration', options.duration);
	if (options.features) path.searchParams.set('features', options.features);
	if (options.page) path.searchParams.set('page', options.page);
	if (options.sort_by) path.searchParams.set('sort_by', options.sort_by);
	if (options.type) path.searchParams.set('type', options.type);

	const resp = await fetchErrorHandle(await fetch(path, fetchOptions));
	return await resp.json();
}

export async function getFeed(
	maxResults: number,
	page: number,
	fetchOptions: RequestInit = {}
): Promise<Feed> {
	if (isYTBackend()) {
		return getFeedYTjs(maxResults, page);
	}

	const path = buildPath('auth/feed');
	path.searchParams.set('max_results', maxResults.toString());
	path.searchParams.set('page', page.toString());
	const resp = await fetchErrorHandle(
		await fetch(path, { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function notificationsMarkAsRead(fetchOptions: RequestInit = {}) {
	// Not support functionality of YTjs
	if (isYTBackend()) return;

	const path = buildPath('auth/notifications');
	await fetchErrorHandle(await fetch(path, { ...buildAuthHeaders(), ...fetchOptions }));
}

export async function getSubscriptions(
	fetchOptions: RequestInit = {},
	bypassYTBackend: boolean = false
): Promise<Subscription[]> {
	if (isYTBackend() && !bypassYTBackend) {
		if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
			return (await getSubscriptionsBackend()).map((sub) => {
				return {
					author: sub.channelName,
					authorId: sub.channelId
				};
			});
		}

		return getSubscriptionsYTjs();
	}
	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/subscriptions'), { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function amSubscribed(
	authorId: string,
	fetchOptions: RequestInit = {}
): Promise<boolean> {
	if (isYTBackend()) {
		if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
			return amSubscribedBackend(authorId);
		}

		return amSubscribedYTjs(authorId);
	}

	if (!get(invidiousAuthStore)) return false;

	try {
		const subscriptions = (await getSubscriptions(fetchOptions)).filter(
			(sub) => sub.authorId === authorId
		);
		return subscriptions.length === 1;
	} catch {
		return false;
	}
}

export async function postSubscribe(
	authorId: string,
	fetchOptions: RequestInit = {},
	bypassYTBackend: boolean = false
) {
	if (isYTBackend() && !bypassYTBackend) {
		if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
			return postSubscribeBackend(authorId);
		}

		return postSubscribeYTjs(authorId);
	}

	await fetchErrorHandle(
		await fetch(buildPath(`auth/subscriptions/${authorId}`), {
			method: 'POST',
			...buildAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function deleteUnsubscribe(authorId: string, fetchOptions: RequestInit = {}) {
	if (isYTBackend()) {
		// deleteUnsubscribeYTjs still should run
		// as cleans feeds of that channel.
		if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
			deleteUnsubscribeBackend(authorId);
		}

		return deleteUnsubscribeYTjs(authorId);
	}

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
	// Not supported functionality of YTjs.
	if (isYTBackend()) {
		return [];
	}

	const path = buildPath(`auth/history`);
	path.searchParams.set('page', page.toString());
	path.searchParams.set('max_results', maxResults.toString());

	const resp = await fetchErrorHandle(
		await fetch(path, {
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
	if (isYTBackend()) return;

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
	if (isYTBackend()) return;

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
	if (isYTBackend() || useEngineFallback('Playlist')) {
		return await getPlaylistYTjs(playlistId);
	}

	let resp;

	const path = buildPath(`${get(invidiousAuthStore) ? 'auth/' : ''}playlists/${playlistId}`);
	path.searchParams.set('page', page.toString());

	if (get(invidiousAuthStore)) {
		resp = await fetch(path, {
			...buildAuthHeaders(),
			...fetchOptions
		});
	} else {
		resp = await fetch(path, fetchOptions);
	}
	await fetchErrorHandle(resp);
	return await resp.json();
}

export async function getPersonalPlaylists(
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage[]> {
	if (isYTBackend()) return [];

	const resp = await fetchErrorHandle(
		await fetch(buildPath('auth/playlists'), { ...buildAuthHeaders(), ...fetchOptions })
	);
	return await resp.json();
}

export async function deletePersonalPlaylist(playlistId: string) {
	if (isYTBackend()) return;

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
	if (isYTBackend()) return;

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
	if (isYTBackend()) return;

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
	if (isYTBackend()) return;

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

function buildApiExtendedAuthHeaders(): Record<string, Record<string, string>> {
	const authToken = get(invidiousAuthStore)?.token ?? '';
	return { headers: { Authorization: `Bearer ${authToken.replace('SID=', '')}` } };
}

export async function getVideoProgress(
	videoId: string,
	fetchOptions: RequestInit = {}
): Promise<ApiExntendedProgressModel[]> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/video/${encodeURIComponent(videoId)}`, {
			...buildApiExtendedAuthHeaders(),
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
	const headers: Record<string, Record<string, string>> = buildApiExtendedAuthHeaders();
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
			...buildApiExtendedAuthHeaders(),
			...fetchOptions
		})
	);
}

export async function deleteAllVideoProgress(fetchOptions: RequestInit = {}) {
	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/videos`, {
			method: 'DELETE',
			...buildApiExtendedAuthHeaders(),
			...fetchOptions
		})
	);
}
