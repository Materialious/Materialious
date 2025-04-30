import { androidPoTokenMinter } from '$lib/android/youtube/minter';
import type {
	AdaptiveFormats,
	Captions,
	Image,
	StoryBoard,
	Thumbnail,
	VideoBase,
	VideoPlay
} from '$lib/api/model';
import { numberWithCommas } from '$lib/numbers';
import { fromFormat } from '$lib/sabr/formatKeyUtils';
import { interfaceRegionStore, poTokenCacheStore } from '$lib/store';
import { Capacitor } from '@capacitor/core';
import { USER_AGENT } from 'bgutils-js';
import { Buffer } from 'buffer';
import { get } from 'svelte/store';
import { Innertube, UniversalCache, Utils, YT, YTNodes } from 'youtubei.js';

export async function patchYoutubeJs(videoId: string): Promise<VideoPlay> {
	if (!Capacitor.isNativePlatform()) {
		throw new Error('Platform not supported');
	}

	const youtube = await Innertube.create({
		fetch: fetch,
		cache: new UniversalCache(false),
		location: get(interfaceRegionStore),
		user_agent: USER_AGENT,
		enable_session_cache: false
	});

	let sessionPoToken: string;
	let contentPoToken: string;

	const requestKey = 'O43z0dpjhgX20SCx4KAo';
	const challengeResponse = await youtube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');

	if (Capacitor.getPlatform() === 'android') {
		[sessionPoToken, contentPoToken] = await androidPoTokenMinter(
			challengeResponse,
			requestKey,
			youtube.session.context.client.visitorData ?? '',
			videoId
		);
	} else {
		[sessionPoToken, contentPoToken] = await window.electronAPI.generatePoToken(
			challengeResponse,
			requestKey,
			youtube.session.context.client.visitorData ?? '',
			videoId
		);
	}

	poTokenCacheStore.set(sessionPoToken);

	const extraArgs: Record<string, any> = {
		playbackContext: {
			contentPlaybackContext: {
				vis: 0,
				splay: false,
				lactMilliseconds: '-1',
				signatureTimestamp: youtube.session.player?.sts
			}
		},
		contentCheckOk: true,
		racyCheckOk: true
	};

	const clientPlaybackNonce = Utils.generateRandomString(12);

	const watchEndpoint = new YTNodes.NavigationEndpoint({ watchEndpoint: { videoId } });
	const rawPlayerResponse = await watchEndpoint.call(youtube.actions, {
		...extraArgs,
		parse: false
	});
	const rawNextResponse = await watchEndpoint.call(youtube.actions, {
		override_endpoint: '/next',
		racyCheckOk: true,
		contentCheckOk: true
	});
	const video = new YT.VideoInfo(
		[rawPlayerResponse, rawNextResponse],
		youtube.actions,
		clientPlaybackNonce
	);

	if (!video.primary_info || !video.secondary_info) {
		throw new Error('Unable to pull video info from youtube.js');
	}

	let dashUri: string | undefined;

	if (video.streaming_data) {
		video.streaming_data.adaptive_formats = video.streaming_data.adaptive_formats.map((format) => {
			const formatKey = fromFormat(format) || '';
			format.url = `https://sabr?___key=${formatKey}`;
			format.signature_cipher = undefined;
			format.decipher = () => format.url || '';

			return format;
		});

		if (video.basic_info.is_live) {
			dashUri = video.streaming_data.dash_manifest_url
				? `${video.streaming_data.dash_manifest_url}/mpd_version/7`
				: video.streaming_data.hls_manifest_url;
		} else if (video.streaming_data.dash_manifest_url && video.basic_info.is_post_live_dvr) {
			dashUri = video.streaming_data.hls_manifest_url
				? video.streaming_data.hls_manifest_url // HLS is preferred for DVR streams.
				: `${video.streaming_data.dash_manifest_url}/mpd_version/7`;
		} else {
			dashUri = `data:application/dash+xml;base64,${btoa(await video.toDash(undefined, undefined, { captions_format: 'vtt' }))}`;
		}
	}

	if (!dashUri) throw Error('Unable to find suitable dash manifest');

	const descString = video.secondary_info.description?.toString() || '';

	let authorThumbnails: Image[];
	if (video.basic_info.channel_id) {
		const channel = await youtube.getChannel(video.basic_info.channel_id);
		authorThumbnails = channel.metadata.avatar as Image[];
	} else {
		authorThumbnails = [];
	}

	const recommendedVideos: VideoBase[] = [];
	video.watch_next_feed?.forEach((recommended: Record<string, any>) => {
		recommendedVideos.push({
			videoThumbnails: (recommended?.thumbnails as Thumbnail[]) || [],
			videoId: recommended?.id || '',
			title: recommended?.title?.toString() || '',
			viewCountText: recommended.view_count
				? numberWithCommas(Number(recommended?.view_count.toString().replace(/\D/g, ''))) || ''
				: '',
			lengthSeconds: recommended?.duration?.seconds || 0,
			author: recommended?.author?.name || '',
			authorId: recommended?.author?.id || ''
		});
	});

	const captions: Captions[] = [];
	video.captions?.caption_tracks?.forEach((caption) => {
		captions.push({
			label: caption.name?.toString() || '',
			language_code: caption.language_code,
			// Add correct format to url.
			url: caption.base_url + '&fmt=vtt'
		});
	});

	const adaptiveFormats: AdaptiveFormats[] = [];
	video.streaming_data?.adaptive_formats.forEach((format) => {
		adaptiveFormats.push({
			index: format.index_range?.start?.toString() || '',
			bitrate: format.bitrate?.toString() || '',
			init: format.init_range?.start?.toString() || '',
			url: format.url || '',
			itag: format.itag?.toString() || '',
			type: format.mime_type,
			clen: '',
			lmt: '',
			projectionType: 0,
			resolution: format.width ? `${format.width}x${format.height}` : undefined
		});
	});

	const storyboard: StoryBoard[] = [];
	if (video.storyboards && 'boards' in video.storyboards) {
		video.storyboards.boards.forEach((board) => {
			storyboard.push({
				templateUrl: board.template_url,
				url: board.template_url,
				count: board.storyboard_count,
				height: board.thumbnail_height,
				width: board.thumbnail_width,
				interval: board.interval,
				storyboardCount: board.storyboard_count,
				storyboardHeight: board.thumbnail_height,
				storyboardWidth: board.thumbnail_width
			});
		});
	}

	return {
		type: 'video',
		title: video.primary_info.title?.toString() || '',
		viewCount: Number(video.basic_info.view_count || 0),
		viewCountText: video.basic_info.view_count?.toString() || '0',
		likeCount: video.basic_info.like_count || 0,
		dislikeCount: 0,
		allowRatings: false,
		rating: 0,
		isListed: 0,
		isFamilyFriendly: video.basic_info.is_family_safe || true,
		genre: video.basic_info.category || '',
		genreUrl: '',
		dashUrl: dashUri,
		adaptiveFormats: adaptiveFormats,
		formatStreams: [],
		recommendedVideos: recommendedVideos,
		authorThumbnails: authorThumbnails,
		captions: captions,
		authorId: video.basic_info.channel_id || '',
		authorUrl: `/channel/${video.basic_info.channel_id}`,
		authorVerified: false,
		description: descString,
		descriptionHtml: video.secondary_info.description?.toHTML() || descString,
		published: 0,
		publishedText: video.primary_info.published?.toString() || '',
		premiereTimestamp: 0,
		hlsUrl: video.streaming_data?.hls_manifest_url || undefined,
		liveNow: video.basic_info.is_live || false,
		premium: false,
		storyboards: storyboard,
		isUpcoming: false,
		videoId: videoId,
		videoThumbnails: video.basic_info.thumbnail as Thumbnail[],
		author: video.basic_info.author || 'Unknown',
		lengthSeconds: video.basic_info.duration || 0,
		subCountText: '',
		keywords: video.basic_info.keywords || [],
		allowedRegions: [],
		ytjs: {
			innertube: youtube,
			video: video,
			clientPlaybackNonce: clientPlaybackNonce,
			rawApiResponse: rawPlayerResponse
		},
		fallbackPatch: 'youtubejs'
	};
}
