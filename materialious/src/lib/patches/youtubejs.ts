import { androidPoTokenMinter } from '$lib/android/youtube/minter';
import type {
	AdaptiveFormats,
	Image,
	StoryBoard,
	Thumbnail,
	VideoBase,
	VideoPlay
} from '$lib/api/model';
import { fromFormat } from '$lib/sabr/formatKeyUtils';
import { interfaceRegionStore, poTokenCacheStore } from '$lib/store';
import { Capacitor } from '@capacitor/core';
import BG, { USER_AGENT } from 'bgutils-js';
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
		enable_session_cache: false,
		player_id: '0004de42'
	});

	const visitorData = youtube.session.context.client.visitorData ?? '';

	const requestKey = 'O43z0dpjhgX20SCx4KAo';
	const challengeResponse = await youtube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');

	if (!challengeResponse.bg_challenge) throw new Error('Could not get challenge');

	const platformMinter =
		Capacitor.getPlatform() === 'android'
			? androidPoTokenMinter
			: window.electronAPI.generatePoToken;

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
		override_endpoint: '/next'
	});
	const video = new YT.VideoInfo(
		[rawPlayerResponse, rawNextResponse],
		youtube.actions,
		clientPlaybackNonce
	);

	if (!video.primary_info || !video.secondary_info) {
		throw new Error('Unable to pull video info from youtube.js');
	}

	if (video.basic_info.is_live) {
		poTokenCacheStore.set(
			await platformMinter(challengeResponse.bg_challenge, requestKey, visitorData)
		);
	} else {
		poTokenCacheStore.set(BG.PoToken.generateColdStartToken(visitorData));

		platformMinter(challengeResponse.bg_challenge, requestKey, visitorData).then((poToken) =>
			poTokenCacheStore.set(poToken)
		);
	}

	let dashUri: string | undefined;

	if (video.streaming_data) {
		video.streaming_data.adaptive_formats.forEach((format) => {
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
			dashUri = `data:application/dash+xml;base64,${btoa(await video.toDash({ manifest_options: { captions_format: 'vtt' } }))}`;
		}
	}

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
		if (
			!recommended.metadata?.title?.text ||
			recommended.content_type !== 'VIDEO' ||
			!recommended.metadata.metadata.metadata_rows ||
			recommended.metadata.metadata.metadata_rows.length < 2
		) {
			return;
		}

		recommendedVideos.push({
			videoThumbnails: (recommended?.content_image?.image as Thumbnail[]) || [],
			videoId: recommended?.content_id || '',
			title: recommended.metadata?.title?.text || '',
			viewCountText: recommended.metadata.metadata.metadata_rows[1]?.metadata_parts[0]
				? recommended.metadata.metadata.metadata_rows[1]?.metadata_parts[0]?.text.text?.replace(
						'views',
						''
					)
				: '',
			lengthSeconds: recommended?.duration?.seconds || 0,
			author: recommended.metadata.metadata.metadata_rows[0]?.metadata_parts[0]?.text.text || '',
			authorId:
				recommended.metadata?.image?.renderer_context?.command_context?.on_tap.payload?.browseId ||
				''
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
		title: video.primary_info?.title?.toString() || '',
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
		captions: [],
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
		// @ts-expect-error Type does have offer_id
		premium: video?.playability_status?.error_screen?.offer_id === 'sponsors_only_video',
		storyboards: storyboard,
		isUpcoming: video?.playability_status?.status !== 'OK',
		videoId: videoId,
		videoThumbnails: video.basic_info.thumbnail as Thumbnail[],
		author: video.basic_info.author || 'Unknown',
		lengthSeconds: video.basic_info.duration || 0,
		subCountText: video.secondary_info.owner?.subscriber_count.text || '',
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
