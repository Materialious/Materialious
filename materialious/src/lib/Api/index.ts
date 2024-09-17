import { numberWithCommas } from '$lib/misc';
import { Capacitor } from '@capacitor/core';
import { get } from 'svelte/store';
import {
	authStore,
	deArrowInstanceStore,
	deArrowThumbnailInstanceStore,
	instanceStore,
	interfaceRegionStore,
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
	Image,
	Playlist,
	PlaylistPage,
	ReturnYTDislikes,
	SearchSuggestion,
	Subscription,
	SynciousProgressModel,
	Thumbnail,
	Video,
	VideoBase,
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
		} catch { }
		throw Error(message);
	}

	return response;
}

export function buildAuthHeaders(): { headers: { Authorization: string; }; } {
	return { headers: { Authorization: `Bearer ${get(authStore)?.token}` } };
}

export async function getTrending(): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(setRegion(buildPath('trending'))));
	return await resp.json();
}

export async function getPopular(): Promise<Video[]> {
	const resp = await fetchErrorHandle(await fetch(buildPath('popular')));
	return await resp.json();
}

export async function getVideo(videoId: string, local: boolean = false): Promise<VideoPlay> {
	const resp = await fetch(setRegion(buildPath(`videos/${videoId}?local=${local}`)));
	if (!resp.ok && Capacitor.getPlatform() !== 'web') {
		const innertube = (await import('youtubei.js')).Innertube;
		const youtube = await innertube.create();

		const video = await youtube.getInfo(videoId);

		if (!video.primary_info || !video.secondary_info) {
			throw new Error('Unable to pull video info from youtube.js');
		}

		const manifest = await video.toDash();
		const dashUri = URL.createObjectURL(new Blob([manifest], { type: 'application/dash+xml;charset=utf8' }));

		const descString = video.secondary_info.description.toString();

		let authorThumbnails: Image[];
		if (video.basic_info.channel_id) {
			authorThumbnails = (await youtube.getChannel(video.basic_info.channel_id)).metadata.avatar as Image[];
		} else {
			authorThumbnails = [];
		}

		let recommendedVideos: VideoBase[] = [];
		video.watch_next_feed?.forEach((recommended: Record<string, any>) => {
			recommendedVideos.push({
				videoThumbnails: recommended?.thumbnails as Thumbnail[] || [],
				videoId: recommended?.id || '',
				title: recommended?.title.toString() || '',
				viewCountText: numberWithCommas(Number(recommended?.view_count.toString().replace(/\D/g, '') || 0)) || '',
				lengthSeconds: recommended?.duration?.seconds || 0,
				author: recommended?.author.name || '',
				authorId: recommended?.author.id || ''
			});
		});

		return {
			type: 'video',
			title: video.primary_info.title.toString(),
			viewCount: Number(video.primary_info.view_count.toString().replace(/\D/g, '')),
			viewCountText: video.primary_info.view_count.toString(),
			likeCount: video.basic_info.like_count || 0,
			dislikeCount: 0,
			allowRatings: false,
			rating: 0,
			isListed: 0,
			isFamilyFriendly: video.basic_info.is_family_safe || true,
			genre: video.basic_info.category || '',
			genreUrl: '',
			dashUrl: dashUri,
			adaptiveFormats: [],
			formatStreams: [],
			recommendedVideos: recommendedVideos,
			authorThumbnails: authorThumbnails,
			captions: [],
			authorId: video.basic_info.channel_id || '',
			authorUrl: `/channel/${video.basic_info.channel_id}`,
			authorVerified: false,
			description: descString,
			descriptionHtml: video.secondary_info.description.toHTML() || descString,
			published: 0,
			publishedText: video.primary_info.published.toString(),
			premiereTimestamp: 0,
			liveNow: false,
			premium: false,
			isUpcoming: false,
			videoId: videoId,
			videoThumbnails: video.basic_info.thumbnail as Thumbnail[],
			author: video.basic_info.author || 'Unknown',
			lengthSeconds: video.basic_info.duration || 0,
			subCountText: '',
			keywords: video.basic_info.keywords || [],
			allowedRegions: []
		};
	} else {
		await fetchErrorHandle(resp);
	}
	return await resp.json();
}

export async function getDislikes(videoId: string): Promise<ReturnYTDislikes> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(returnYTDislikesInstanceStore)}/votes?videoId=${videoId}`)
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

	const path = buildPath(`comments/${videoId}`);
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

	const url = buildPath(`channels/${channelId}/${parameters.type}`);

	if (typeof parameters.continuation !== 'undefined')
		url.searchParams.set('continuation', parameters.continuation);

	const resp = await fetchErrorHandle(await fetch(url.toString()));
	return await resp.json();
}

export async function getSearchSuggestions(search: string): Promise<SearchSuggestion> {
	const path = buildPath('search/suggestions');
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

	const path = buildPath('search');
	path.search = new URLSearchParams({ ...options, q: search }).toString();
	const resp = await fetchErrorHandle(await fetch(setRegion(path)));
	return await resp.json();
}

export async function getFeed(maxResults: number, page: number): Promise<Feed> {
	const path = buildPath('auth/feed');
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
	if (!get(authStore)) return false;

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
		await fetch(
			buildPath(`auth/history?page=${page}&max_results=${maxResults}`),
			buildAuthHeaders()
		)
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

	if (get(authStore)) {
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
		await fetch(`${get(deArrowInstanceStore)}/api/branding?videoID=${videoId}`)
	);
	return await resp.json();
}

export async function getThumbnail(videoId: string, time: number): Promise<string> {
	const resp = await fetchErrorHandle(
		await fetch(
			`${get(deArrowThumbnailInstanceStore)}/api/v1/getThumbnail?videoID=${videoId}&time=${time}`
		)
	);
	return URL.createObjectURL(await resp.blob());
}

export async function getVideoProgress(videoId: string): Promise<SynciousProgressModel[]> {
	const resp = await fetchErrorHandle(
		await fetch(
			`${get(synciousInstanceStore)}/video/${encodeURIComponent(videoId)}`,
			buildAuthHeaders()
		)
	);

	return resp.json();
}

export async function saveVideoProgress(videoId: string, time: number) {
	const headers: Record<string, Record<string, string>> = buildAuthHeaders();
	headers['headers']['Content-type'] = 'application/json';

	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/video/${encodeURIComponent(videoId)}`, {
			...headers,
			method: 'POST',
			body: JSON.stringify({
				time: time
			})
		})
	);
}

export async function deleteVideoProgress(videoId: string) {
	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/video/${videoId}`, {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}

export async function deleteAllVideoProgress() {
	await fetchErrorHandle(
		await fetch(`${get(synciousInstanceStore)}/videos`, {
			method: 'DELETE',
			...buildAuthHeaders()
		})
	);
}
