import { getVideoYTjs } from '$lib/api/youtubejs/video';
import { get } from 'svelte/store';
import { invidiousAuthStore, playerYouTubeJsAlways, rawMasterKeyStore } from '../store';
import type {
	ChannelPage,
	Comments,
	Feed,
	PlaylistPage,
	ResolvedUrl,
	SearchSuggestion,
	Subscription,
	Video,
	VideoPlay,
	SearchOptions,
	SearchResults,
	CommentsOptions,
	ChannelOptions,
	ChannelContent,
	VideoWatchHistory
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
} from './backend/subscriptions';
import { getFeedInvidious, getPopularInvidious, getSubscriptionsInvidious } from './invidious/feed';
import { getResolveUrlInvidious } from './invidious/misc';
import { getVideoInvidious } from './invidious/video';
import { getCommentsInvidious } from './invidious/comments';
import {
	getChannelContentInvidious,
	getChannelInvidious,
	searchChannelContentInvidious
} from './invidious/channel';
import { getSearchSuggestionsInvidious } from './invidious/searchSuggestions';
import { getHashtagInvidious } from './invidious/hashtag';
import { getSearchInvidious } from './invidious/search';
import { notificationsMarkAsReadInvidious } from './invidious/notifcations';
import {
	amSubscribedInvidious,
	deleteUnsubscribeInvidious,
	postSubscribeInvidious
} from './invidious/subscribe';
import { postHistoryInvidious } from './invidious/history';
import {
	addPlaylistVideoInvidious,
	deletePersonalPlaylistInvidious,
	getPersonalPlaylistsInvidious,
	getPlaylistInvidious,
	postPersonalPlaylistInvidious,
	removePlaylistVideoInvidious
} from './invidious/playlist';
import {
	deleteWatchHistoryBackend,
	getVideoWatchHistoryBackend,
	getWatchHistoryBackend,
	saveWatchHistoryBackend,
	updateWatchHistoryBackend
} from './backend/history';

export async function getPopular(fetchOptions?: RequestInit): Promise<Video[]> {
	// Doesn't exist in YTjs.
	if (isYTBackend()) {
		return [];
	}

	return getPopularInvidious(fetchOptions);
}

export async function getResolveUrl(url: string): Promise<ResolvedUrl> {
	if (isYTBackend() || useEngineFallback('ResolveUrl')) {
		return getResolveUrlYTjs(url);
	}

	return getResolveUrlInvidious(url);
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
		return getVideoYTjs(videoId);
	}

	return getVideoInvidious(videoId, local, fetchOptions);
}

export async function getComments(
	videoId: string,
	options: CommentsOptions,
	fetchOptions?: RequestInit
): Promise<Comments> {
	commentsSetDefaults(options);

	if (isYTBackend() || useEngineFallback('Comments')) {
		return getCommentsYTjs(videoId, options);
	}

	return getCommentsInvidious(videoId, options, fetchOptions);
}

export async function getChannel(
	channelId: string,
	fetchOptions?: RequestInit
): Promise<ChannelPage> {
	if (isYTBackend() || useEngineFallback('Channel')) {
		return getChannelYTjs(channelId);
	}

	return getChannelInvidious(channelId, fetchOptions);
}

export async function getChannelContent(
	channelId: string,
	options: ChannelOptions,
	fetchOptions?: RequestInit
): Promise<ChannelContent> {
	if (typeof options.type === 'undefined') options.type = 'videos';

	if (isYTBackend() || useEngineFallback('ChannelContent')) {
		return getChannelContentYTjs(channelId, options);
	}

	return getChannelContentInvidious(channelId, options, fetchOptions);
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

	return searchChannelContentInvidious(channelId, search, fetchOptions);
}

export async function getSearchSuggestions(
	search: string,
	fetchOptions?: RequestInit
): Promise<SearchSuggestion> {
	if (isYTBackend() || useEngineFallback('SearchSuggestions')) {
		return getSearchSuggestionsYTjs(search);
	}

	return getSearchSuggestionsInvidious(search, fetchOptions);
}

export async function getHashtag(tag: string, page: number = 0): Promise<{ results: Video[] }> {
	// TODO: Implement in YTjs
	if (isYTBackend()) return { results: [] };

	return getHashtagInvidious(tag, page);
}

export async function getSearch(
	search: string,
	options: SearchOptions,
	fetchOptions?: RequestInit
): Promise<SearchResults> {
	searchSetDefaults(options);

	if (isYTBackend() || useEngineFallback('Search')) {
		return getSearchYTjs(search, options);
	}

	return getSearchInvidious(search, options, fetchOptions);
}

export async function getFeed(
	maxResults: number,
	page: number,
	fetchOptions: RequestInit = {}
): Promise<Feed> {
	if (isYTBackend()) {
		return getFeedYTjs(maxResults, page);
	}

	return getFeedInvidious(maxResults, page, fetchOptions);
}

export async function notificationsMarkAsRead(fetchOptions: RequestInit = {}) {
	// Not support functionality of YTjs
	if (isYTBackend()) return;

	return notificationsMarkAsReadInvidious(fetchOptions);
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

	return getSubscriptionsInvidious(fetchOptions);
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

	return amSubscribedInvidious(authorId, fetchOptions);
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

	return postSubscribeInvidious(authorId, fetchOptions);
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

	return deleteUnsubscribeInvidious(authorId, fetchOptions);
}

export async function getWatchHistory(
	options: { page?: number; videoIds?: string[]; fetchOptions?: RequestInit } = {
		page: undefined,
		videoIds: undefined,
		fetchOptions: undefined
	}
): Promise<VideoWatchHistory[]> {
	if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
		return getWatchHistoryBackend(options);
	}
}

export async function getVideoWatchHistory(
	videoId: string
): Promise<VideoWatchHistory | undefined> {
	if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
		return getVideoWatchHistoryBackend(videoId);
	}
}

export async function deleteWatchHistory() {
	if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
		return deleteWatchHistoryBackend();
	}
}

export async function updateWatchHistory(
	videoId: string,
	progress: number,
	fetchOptions: RequestInit = {}
) {
	if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
		return updateWatchHistoryBackend(videoId, progress);
	}

	if (get(invidiousAuthStore)) postHistoryInvidious(videoId, fetchOptions);
}

export async function saveWatchHistory(video: VideoPlay, progress: number = 0) {
	if (isOwnBackend()?.internalAuth && get(rawMasterKeyStore)) {
		return saveWatchHistoryBackend(video, progress);
	}
}

export async function getPlaylist(
	playlistId: string,
	page: number = 1,
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage> {
	if (isYTBackend() || useEngineFallback('Playlist')) {
		return await getPlaylistYTjs(playlistId);
	}

	return getPlaylistInvidious(playlistId, page, fetchOptions);
}

export async function getPersonalPlaylists(
	fetchOptions: RequestInit = {}
): Promise<PlaylistPage[]> {
	if (isYTBackend()) return [];

	return getPersonalPlaylistsInvidious(fetchOptions);
}

export async function deletePersonalPlaylist(playlistId: string) {
	if (isYTBackend()) return;

	return deletePersonalPlaylistInvidious(playlistId);
}

export async function postPersonalPlaylist(
	title: string,
	privacy: 'public' | 'private' | 'unlisted',
	fetchOptions: RequestInit = {}
) {
	if (isYTBackend()) return;
	return postPersonalPlaylistInvidious(title, privacy, fetchOptions);
}

export async function addPlaylistVideo(
	playlistId: string,
	videoId: string,
	fetchOptions: RequestInit = {}
) {
	if (isYTBackend()) return;
	return addPlaylistVideoInvidious(playlistId, videoId, fetchOptions);
}

export async function removePlaylistVideo(
	playlistId: string,
	indexId: string,
	fetchOptions: RequestInit = {}
) {
	if (isYTBackend()) return;

	return removePlaylistVideoInvidious(playlistId, indexId, fetchOptions);
}
