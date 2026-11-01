import { androidPoTokenMinter } from '$lib/android/youtube/minter';
import { getChannelCached } from './channelCache';
import type {
	AdaptiveFormats,
	Captions,
	Image,
	StoryBoard,
	StreamingBinding,
	Thumbnail,
	VideoBase,
	VideoPlay
} from '$lib/api/model';
import { poTokenCacheStore } from '$lib/store';
import { convertToSeconds } from '$lib/time';
import { Capacitor } from '@capacitor/core';
import { get } from 'svelte/store';
import type { Types } from 'youtubei.js';
import { Innertube, Utils, YT, YTNodes, Platform } from 'youtubei.js';
import { getInnertube } from '.';
import { getSignedInInnertube } from './account';
import { isUnrestrictedPlatform } from '$lib/misc';
import { webPoTokenMinter } from '$lib/web/youtube/minter';
import { associateAvatar } from '$lib/thumbnail';

Platform.shim.eval = async (data: Types.BuildScriptResult) => new Function(data.output)();

export interface VideoIntermediate {
	innertube: Innertube;
	video: YT.VideoInfo;
	clientPlaybackNonce: string;
	rawPlayerResponse: import('youtubei.js').ApiResponse;
	/** The token the signed-in request was made with, bound to the video. */
	playerPoToken?: string;
	authorThumbnails: Image[];
	descString: string;
	recommendedVideos: VideoBase[];
	storyboard: StoryBoard[];
}

const videoIntermediateCache = new Map<string, VideoIntermediate>();

/**
 * What a playback token has to be bound to.
 *
 * Anonymously that is the video. A signed-in session's token has to be bound
 * to the account instead - its data sync id, which every signed-in response
 * carries - and a token bound to the video is refused by the streaming server
 * as "sabr.malformed_config" a few seconds into playback.
 */
function poTokenBinding(
	innertube: Innertube,
	playerResponse: import('youtubei.js').ApiResponse,
	videoId: string
): string {
	if (!innertube.session.logged_in) return videoId;

	const datasyncId = (
		playerResponse.data as
			| { responseContext?: { mainAppWebResponseContext?: { datasyncId?: string } } }
			| undefined
	)?.responseContext?.mainAppWebResponseContext?.datasyncId;

	// Written "<account>||<delegated account>", where only the first is wanted.
	return datasyncId?.split('||')[0] || videoId;
}

const REQUEST_KEY = 'O43z0dpjhgX20SCx4KAo';

function platformMinter(): (requestKey: string, visitorData: string) => Promise<string> {
	switch (Capacitor.getPlatform()) {
		case 'electron':
			return window.electronAPI.generatePoToken;
		case 'android':
			return androidPoTokenMinter;
		default:
			return webPoTokenMinter;
	}
}

/** A playback token, minted by whatever this platform mints with. */
export function mintPoToken(binding: string): Promise<string> {
	return platformMinter()(REQUEST_KEY, binding);
}

/**
 * Which account a signed-in session is, from the guide, which YouTube answers
 * without a bot check.
 */
async function accountOf(innertube: Innertube): Promise<string | undefined> {
	const answer = await innertube.actions.execute('/guide', { parse: false });
	const data = (typeof answer.data === 'string' ? JSON.parse(answer.data) : answer.data) as
		| { responseContext?: { mainAppWebResponseContext?: { datasyncId?: string } } }
		| undefined;

	// Written "<account>||<delegated account>", where only the first is wanted.
	return data?.responseContext?.mainAppWebResponseContext?.datasyncId?.split('||')[0] || undefined;
}

/** The pair `vb=1`, as it is encoded inside a format's xtags. */
const VB_TAG = String.fromCharCode(0x0a, 0x02, 0x76, 0x62, 0x12, 0x01, 0x31);

/**
 * Whether a format is one of the `vb=1` variants that make the streaming
 * server ask for the player response to be reloaded partway into a video.
 *
 * On its own that tag is written "CgcKAnZiEgEx", which is what used to be
 * matched. A video with dubbed audio tracks has it alongside the language -
 * "acont=original, lang=en-US, vb=1" - which encodes to something else
 * entirely, so its original-language audio came through twice, the reload
 * followed, and the video stopped.
 */
function hasVbTag(xtags: string | undefined): boolean {
	if (!xtags) return false;

	try {
		const base64 = xtags.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');

		return atob(padded).includes(VB_TAG);
	} catch {
		return false;
	}
}

function playabilityStatusOf(response: import('youtubei.js').ApiResponse): string | undefined {
	return (response.data as { playabilityStatus?: { status?: string } } | undefined)
		?.playabilityStatus?.status;
}

/**
 * What YouTube said when it would not play a video, for saying so on the page.
 *
 * A premiere that has not started and a members-only video are refusals too,
 * but each already has a screen of its own, so they are left to those.
 */
function refusalOf(video: YT.VideoInfo, signedInTried: boolean): VideoPlay['unplayable'] {
	const playability = video.playability_status;
	if (!playability || playability.status === 'OK') return undefined;
	if (video.basic_info.is_upcoming) return undefined;
	if ((video as any)?.playability_status?.error_screen?.offer_id === 'sponsors_only_video') {
		return undefined;
	}

	const errorScreen = playability.error_screen as
		| { subreason?: { toString(): string } }
		| undefined;
	const subreason = errorScreen?.subreason?.toString() ?? '';

	return {
		status: playability.status,
		reason: playability.reason || '',
		subreason: subreason !== playability.reason ? subreason : '',
		signInRequired: playability.status === 'LOGIN_REQUIRED',
		signedInTried
	};
}

export async function getVideoPageYTjs(videoId: string): Promise<VideoPlay> {
	if (!isUnrestrictedPlatform()) {
		throw new Error('Platform not supported');
	}

	let innertube = await getInnertube();

	const clientPlaybackNonce = Utils.generateRandomString(16);

	const watchEndpoint = new YTNodes.NavigationEndpoint({ watchEndpoint: { videoId } });
	const askForPlayer = (session: Innertube, poToken?: string) =>
		watchEndpoint.call(session.actions, {
			contentCheckOk: true,
			racyCheckOk: true,
			playbackContext: {
				contentPlaybackContext: {
					signatureTimestamp: session.session.player?.signature_timestamp
				}
			},
			...(poToken ? { serviceIntegrityDimensions: { poToken } } : {})
		});

	let rawPlayerResponse = await askForPlayer(innertube);

	// Some videos YouTube plays only to somebody signed in - most often because
	// they are age-restricted. Those, and only those, are asked for again as the
	// saved account, which then plays them too: everything else stays anonymous,
	// so the account is told about no more than it has to be.
	let signedInTried = false;
	let playerPoToken: string | undefined;

	if (playabilityStatusOf(rawPlayerResponse) === 'LOGIN_REQUIRED') {
		const signedIn = await getSignedInInnertube().catch(() => undefined);

		if (signedIn) {
			signedInTried = true;
			innertube = signedIn;

			// Asked without a token first. Since one was sent with this request -
			// bound to the account, then to the video - the streaming server has
			// refused every request after the first with "sabr.malformed_config",
			// whatever the streaming token was bound to, and playback stopped
			// when the first minute ran out. Asked without, it played. Only if
			// YouTube will not answer that is a token sent after all.
			rawPlayerResponse = await askForPlayer(signedIn);

			if (playabilityStatusOf(rawPlayerResponse) !== 'OK') {
				playerPoToken = await platformMinter()(REQUEST_KEY, videoId).catch(() => undefined);
				if (playerPoToken) rawPlayerResponse = await askForPlayer(signedIn, playerPoToken);
			}
		}
	}

	const rawNextResponse = await watchEndpoint.call(innertube.actions, {
		override_endpoint: '/next'
	});
	const video = new YT.VideoInfo(
		[rawPlayerResponse, rawNextResponse],
		innertube.actions,
		clientPlaybackNonce
	);

	if (!video.primary_info || !video.secondary_info) {
		throw new Error('Unable to pull video info from youtube.js');
	}

	const descString = video.secondary_info.description?.toString() || '';

	// Whose video it is. The player's answer says so, but a refused one - "Sign
	// in to confirm you're not a bot" - carries no details at all, and the page
	// built its link to the channel out of nothing and stopped dead. The watch
	// page's own byline still names the channel, so it stands in.
	const owner = video.secondary_info.owner?.author;
	const authorId = video.basic_info.channel_id || owner?.id || '';
	const author = video.basic_info.author || owner?.name || 'Unknown';

	let authorThumbnails: Image[];
	if (authorId) {
		const channel = await getChannelCached(authorId);
		authorThumbnails = channel.metadata.avatar as Image[];
		await associateAvatar(authorId, authorThumbnails);
	} else {
		authorThumbnails = [];
	}

	const recommendedVideos: VideoBase[] = [];
	video.watch_next_feed?.forEach((recommended) => {
		if (
			!recommended.is(YTNodes.LockupView) ||
			recommended.content_type !== 'VIDEO' ||
			!recommended.metadata ||
			!recommended.content_image?.is(YTNodes.ThumbnailView) ||
			!recommended.metadata.metadata ||
			recommended.metadata.metadata.metadata_rows.length < 2
		)
			return;

		let lengthSeconds: number = 0;
		recommended.content_image.overlays.forEach((overlay) => {
			if (overlay.is(YTNodes.ThumbnailBottomOverlayView)) {
				overlay.badges.forEach((badge) => {
					if (
						badge.is(YTNodes.ThumbnailBadgeView) &&
						badge.badge_style === 'THUMBNAIL_OVERLAY_BADGE_STYLE_DEFAULT'
					) {
						lengthSeconds = convertToSeconds(badge.text);
					}
				});
			}
		});

		const viewCountText = (
			recommended.metadata.metadata.metadata_rows[1]?.metadata_parts?.[0]?.text?.text ?? ''
		).split(' ')[0];

		recommendedVideos.push({
			videoThumbnails: (recommended?.content_image.image as Thumbnail[]) || [],
			videoId: recommended.content_id,
			title: recommended.metadata.title.toString(),
			viewCountText,
			author: recommended.metadata.metadata.metadata_rows[0]?.metadata_parts?.[0]?.text?.text ?? '',
			lengthSeconds,
			authorId:
				recommended.metadata?.image?.renderer_context?.command_context?.on_tap?.payload?.browseId ||
				'',
			type: 'video'
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
				storyboardWidth: board.thumbnail_width,
				columns: board.columns,
				rows: board.rows
			});
		});
	}

	const intermediate: VideoIntermediate = {
		innertube,
		video,
		clientPlaybackNonce,
		rawPlayerResponse,
		playerPoToken,
		authorThumbnails,
		descString,
		recommendedVideos,
		storyboard
	};

	videoIntermediateCache.set(videoId, intermediate);

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
		dashUrl: undefined,
		adaptiveFormats: [],
		formatStreams: [],
		recommendedVideos: recommendedVideos,
		authorThumbnails: authorThumbnails,
		captions: [],
		authorId,
		authorUrl: `/channel/${authorId}`,
		authorVerified: false,
		description: descString,
		descriptionHtml: video.secondary_info.description?.toHTML() || descString,
		published: 0,
		publishedText: video.primary_info.published?.toString() || '',
		premiereTimestamp: video.basic_info.is_upcoming
			? Math.floor(video.basic_info.start_timestamp?.getTime() || 0 / 1000)
			: undefined,
		hlsUrl: video.streaming_data?.hls_manifest_url || undefined,
		liveNow: video.basic_info.is_live || false,
		premium: (video as any)?.playability_status?.error_screen?.offer_id === 'sponsors_only_video',
		storyboards: storyboard,
		isUpcoming: video?.playability_status?.status !== 'OK',
		unplayable: refusalOf(video, signedInTried),
		videoId: videoId,
		videoThumbnails: video.basic_info.thumbnail as Thumbnail[],
		author,
		lengthSeconds: video.basic_info.duration || 0,
		subCountText: video.secondary_info.owner?.subscriber_count.text || '',
		keywords: video.basic_info.keywords || [],
		allowedRegions: [],
		ytjs: undefined,
		fallbackPatch: 'youtubejs'
	};
}

export async function continueVideoPlayerYTjs(videoId: string): Promise<{
	dashUrl?: string;
	adaptiveFormats: AdaptiveFormats[];
	captions: Captions[];
	hlsUrl?: string;
	ytjs: import('$lib/api/model').Ytjs;
}> {
	const intermediate = videoIntermediateCache.get(videoId);
	if (!intermediate) {
		const full = await getVideoYTjs(videoId);
		return {
			dashUrl: full.dashUrl,
			adaptiveFormats: full.adaptiveFormats,
			captions: full.captions,
			hlsUrl: full.hlsUrl,
			ytjs: full.ytjs!
		};
	}

	videoIntermediateCache.delete(videoId);

	const { innertube, video, clientPlaybackNonce, rawPlayerResponse } = intermediate;

	// Nothing to play means nothing to ask a token for.
	const streamingBindings: StreamingBinding[] = [];

	if (video.streaming_data) {
		let binding = poTokenBinding(innertube, rawPlayerResponse, videoId);
		let kind: StreamingBinding['kind'] = binding === videoId ? 'video' : 'account';

		// The player's answer normally names the account; when it does not,
		// the guide still does.
		if (innertube.session.logged_in && binding === videoId) {
			const account = await accountOf(innertube).catch(() => undefined);
			if (account) {
				binding = account;
				kind = 'guide';
			}
		}

		streamingBindings.push({ kind, value: binding });

		// What else a signed-in session's streaming token could be bound to,
		// for the player to fall back on if the streaming server refuses the
		// first: which one YouTube wants has changed under us more than once.
		if (innertube.session.logged_in) {
			const visitorData = innertube.session.context.client.visitorData;
			if (binding !== videoId) streamingBindings.push({ kind: 'video', value: videoId });
			if (visitorData) streamingBindings.push({ kind: 'visitor', value: visitorData });
		}

		poTokenCacheStore.set(await mintPoToken(binding));
	}

	let dashUri: string | undefined;

	// Unsupported format fix
	// https://github.com/LuanRT/googlevideo/issues/42
	if (video.streaming_data) {
		video.streaming_data.adaptive_formats = video.streaming_data.adaptive_formats.filter(
			(format) => !hasVbTag(format.xtags)
		);
	}

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

	// Live content does not always come with a manifest. A stream can report itself
	// as live or as post live DVR while carrying nothing but ordinary adaptive
	// formats, and interpolating the absent URL yields "undefined/mpd_version/7",
	// which the proxy then rejects as unwhitelisted. Only take the manifest paths
	// when there is a manifest to take; anything else is served like a normal video.
	const liveManifestUrl =
		video.streaming_data?.dash_manifest_url || video.streaming_data?.hls_manifest_url;

	const isPostLiveDVR =
		!!liveManifestUrl &&
		(!!video.basic_info.is_post_live_dvr || !!video.basic_info.is_live_content);

	if (video.streaming_data) {
		if (video.basic_info.is_live && liveManifestUrl) {
			dashUri = video.streaming_data.dash_manifest_url
				? `${video.streaming_data.dash_manifest_url}/mpd_version/7`
				: video.streaming_data.hls_manifest_url;
		} else if (isPostLiveDVR) {
			dashUri = video.streaming_data.hls_manifest_url
				? video.streaming_data.hls_manifest_url
				: `${video.streaming_data.dash_manifest_url}/mpd_version/7`;
		} else {
			const manifest = await video.toDash({
				manifest_options: {
					is_sabr: true,
					include_thumbnails: false
				}
			});
			dashUri = `data:application/dash+xml;base64,${btoa(manifest)}`;
		}
	}

	const captions: Captions[] = [];
	video.captions?.caption_tracks?.forEach((caption) => {
		const url = new URL(caption.base_url);

		url.searchParams.set('potc', '1');
		url.searchParams.set('pot', get(poTokenCacheStore) ?? '');
		url.searchParams.set('c', innertube.session.context.client.clientName);
		url.searchParams.set('fmt', 'vtt');

		url.searchParams.delete('xosf');

		captions.push({
			label: caption.name?.toString() || '',
			language_code: caption.language_code,
			url: url.toString()
		});
	});

	return {
		dashUrl: dashUri,
		adaptiveFormats,
		captions,
		hlsUrl: video.streaming_data?.hls_manifest_url || undefined,
		ytjs: {
			innertube: innertube,
			video: video,
			clientPlaybackNonce: clientPlaybackNonce,
			rawApiResponse: rawPlayerResponse,
			playerPoToken: intermediate.playerPoToken,
			streamingBindings
		}
	};
}

export async function getVideoYTjs(videoId: string): Promise<VideoPlay> {
	const pageVideo = await getVideoPageYTjs(videoId);
	const playerData = await continueVideoPlayerYTjs(videoId);

	return {
		...pageVideo,
		dashUrl: playerData.dashUrl,
		adaptiveFormats: playerData.adaptiveFormats,
		captions: playerData.captions,
		hlsUrl: playerData.hlsUrl,
		ytjs: playerData.ytjs
	};
}
