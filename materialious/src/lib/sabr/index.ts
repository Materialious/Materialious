import type { VideoPlay } from '$lib/api/model';
import { Capacitor } from '@capacitor/core';
import { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';
import type shaka from 'shaka-player/dist/shaka-player.ui';
import { ShakaPlayerAdapter } from './ShakaPlayerAdapter';
import { Constants, YT } from 'youtubei.js';
import { get } from 'svelte/store';
import { poTokenCacheStore } from '$lib/store';
import { buildSabrFormat } from 'googlevideo/utils';

export async function injectSabr(
	video: VideoPlay,
	player: shaka.Player
): Promise<SabrStreamingAdapter | null> {
	if (!video.ytjs || !Capacitor.isNativePlatform()) return null;

	const sabrAdapter = new SabrStreamingAdapter({
		playerAdapter: new ShakaPlayerAdapter(),
		clientInfo: {
			osName: video.ytjs.innertube.session.context.client.osName,
			osVersion: video.ytjs.innertube.session.context.client.osVersion,
			clientName: parseInt(
				Constants.CLIENT_NAME_IDS[
					video.ytjs.innertube.session.context.client
						.clientName as keyof typeof Constants.CLIENT_NAME_IDS
				]
			),
			clientVersion: video.ytjs.innertube.session.context.client.clientVersion
		}
	});

	sabrAdapter.onMintPoToken(async () => {
		return get(poTokenCacheStore) || '';
	});

	sabrAdapter.onReloadPlayerResponse(async (reloadContext) => {
		console.log('[SABR]', 'Reloading player response...');

		if (!video.ytjs) return;

		const reloadedInfo = await video.ytjs.innertube.actions.execute('/player', {
			videoId: video.videoId,
			contentCheckOk: true,
			racyCheckOk: true,
			playbackContext: {
				adPlaybackContext: {
					pyv: true
				},
				contentPlaybackContext: {
					signatureTimestamp: video.ytjs.innertube.session.player?.sts
				},
				reloadPlaybackContext: reloadContext
			}
		});

		const parsedInfo = new YT.VideoInfo(
			[reloadedInfo],
			video.ytjs.innertube.actions,
			video.ytjs.video.cpn
		);
		sabrAdapter.setStreamingURL(
			await video.ytjs.innertube.session.player!.decipher(
				parsedInfo.streaming_data?.server_abr_streaming_url
			)
		);
		sabrAdapter.setUstreamerConfig(
			video.ytjs.video.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config
		);
	});

	const isLive = video.ytjs.video.basic_info.is_live;
	const isPostLiveDVR =
		!!video.ytjs.video.basic_info.is_post_live_dvr ||
		(video.ytjs.video.basic_info.is_live_content &&
			!!(
				video.ytjs.video.streaming_data?.dash_manifest_url ||
				video.ytjs.video.streaming_data?.hls_manifest_url
			));

	if (video.ytjs.video.streaming_data && !isPostLiveDVR && !isLive) {
		sabrAdapter.setStreamingURL(
			await video.ytjs.innertube.session.player!.decipher(
				video.ytjs.video.streaming_data?.server_abr_streaming_url
			)
		);
		sabrAdapter.setUstreamerConfig(
			video.ytjs.video.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config
		);
		sabrAdapter.setServerAbrFormats(
			video.ytjs.video.streaming_data.adaptive_formats.map(buildSabrFormat)
		);
	}

	sabrAdapter.attach(player);

	return sabrAdapter;
}
