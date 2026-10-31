import type { VideoPlay } from '#lib/api/model';
import {
	SabrStreamingAdapter,
	type OnReloadPlayerResponseCb
} from 'googlevideo/sabr-streaming-adapter';
import type shaka from 'shaka-player/dist/shaka-player.ui';
import { ShakaPlayerAdapter } from './ShakaPlayerAdapter';
import { Constants, YT } from 'youtubei.js';
import { get } from 'svelte/store';
import { poTokenCacheStore } from '#lib/store';
import { buildSabrFormat } from 'googlevideo/utils';
import { isUnrestrictedPlatform } from '#lib/backend';
import { mintPoTokenForVideo } from '#lib/api/youtubejs/video';

const ATTESTATION_RETRIES = 3;
const PLAYER_RELOAD_RETRIES = 3;
const PO_TOKEN_REFRESH_COOLDOWN_MS = 15_000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Primes BotGuard attestation state, without it SABR servers may
// silently stop sending media mid-playback until the user seeks.
// https://github.com/LuanRT/YouTube.js/issues/1121
async function primeSabrAttestation(video: VideoPlay): Promise<void> {
	if (!video.ytjs) return;

	for (let attempt = 0; attempt < ATTESTATION_RETRIES; attempt++) {
		try {
			await video.ytjs.innertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
			return;
		} catch (error) {
			if (attempt === ATTESTATION_RETRIES - 1) {
				console.warn('[SABR] Failed to prime attestation', error);
				return;
			}

			await sleep(500 * (attempt + 1));
		}
	}
}

let lastPoTokenRefresh: { videoId: string; at: number } = { videoId: '', at: 0 };
let poTokenRefresh: { videoId: string; promise: Promise<void> } | null = null;

/**
 * Re-primes attestation and mints a fresh playback PoToken. Used when the
 * SABR server signals that attestation is required (stream protection
 * status 3) and by the playback stall watchdog.
 */
export async function refreshSabrSession(video: VideoPlay): Promise<void> {
	// Deduplicate refreshes for the same video, but never let a refresh for a
	// previous video block the newly playing one.
	if (poTokenRefresh?.videoId === video.videoId) return poTokenRefresh.promise;

	if (
		lastPoTokenRefresh.videoId === video.videoId &&
		Date.now() - lastPoTokenRefresh.at < PO_TOKEN_REFRESH_COOLDOWN_MS
	) {
		return;
	}

	const refreshPromise = (async () => {
		await primeSabrAttestation(video);

		try {
			await mintPoTokenForVideo(video.videoId);
		} catch (error) {
			console.warn('[SABR] Failed to refresh PoToken', error);
		}

		lastPoTokenRefresh = { videoId: video.videoId, at: Date.now() };
	})();

	const refreshEntry = { videoId: video.videoId, promise: refreshPromise };
	poTokenRefresh = refreshEntry;

	try {
		await refreshPromise;
	} finally {
		if (poTokenRefresh === refreshEntry) poTokenRefresh = null;
	}
}

export async function injectSabr(
	video: VideoPlay,
	player: shaka.Player
): Promise<SabrStreamingAdapter | null> {
	if (!video.ytjs || !isUnrestrictedPlatform()) return null;

	await primeSabrAttestation(video);

	const shakaPlayerAdapter = new ShakaPlayerAdapter();

	const sabrAdapter = new SabrStreamingAdapter({
		playerAdapter: shakaPlayerAdapter,
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

	shakaPlayerAdapter.setStreamProtectionHandler(async (status) => {
		if (status === 3) {
			console.warn('[SABR] Server requested attestation, refreshing PoToken');
			await refreshSabrSession(video);
		}
	});

	sabrAdapter.onMintPoToken(async () => {
		const cached = get(poTokenCacheStore);
		if (cached) return cached;

		try {
			return await mintPoTokenForVideo(video.videoId);
		} catch (error) {
			console.warn('[SABR] Failed to mint PoToken on demand', error);
			return '';
		}
	});

	sabrAdapter.onSnackbarMessage((snackbarMessage) => {
		console.warn('[SABR] Server message:', snackbarMessage);
	});

	const reloadPlayerResponse = async (
		reloadContext: Parameters<OnReloadPlayerResponseCb>[0]
	): Promise<void> => {
		if (!video.ytjs) throw new Error('YouTube.js session is unavailable');

		const innertube = video.ytjs.innertube;

		const reloadedInfo = await innertube.actions.execute('/player', {
			videoId: video.videoId,
			contentCheckOk: true,
			racyCheckOk: true,
			playbackContext: {
				contentPlaybackContext: {
					signatureTimestamp: innertube.session.player?.signature_timestamp
				},
				reloadPlaybackContext: reloadContext
			}
		});

		const parsedInfo = new YT.VideoInfo([reloadedInfo], innertube.actions, video.ytjs.video.cpn);

		const streamingUrl = parsedInfo.streaming_data?.server_abr_streaming_url;
		if (!streamingUrl) {
			throw new Error('Reloaded player response did not include a SABR streaming URL');
		}

		const decipheredUrl = await innertube.session.player!.decipher(streamingUrl);
		if (!decipheredUrl) {
			throw new Error('Unable to decipher reloaded SABR streaming URL');
		}

		sabrAdapter.setStreamingURL(decipheredUrl);

		const ustreamerConfig =
			parsedInfo.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config ??
			video.ytjs.video.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config;

		if (ustreamerConfig) sabrAdapter.setUstreamerConfig(ustreamerConfig);
	};

	sabrAdapter.onReloadPlayerResponse(async (reloadContext) => {
		let lastError: unknown;

		for (let attempt = 0; attempt < PLAYER_RELOAD_RETRIES; attempt++) {
			try {
				await reloadPlayerResponse(reloadContext);
				return;
			} catch (error) {
				lastError = error;
				console.warn(
					`[SABR] Failed to reload player response (attempt ${attempt + 1}/${PLAYER_RELOAD_RETRIES})`,
					error
				);

				if (attempt < PLAYER_RELOAD_RETRIES - 1) {
					await sleep(500 * (attempt + 1));
				}
			}
		}

		throw lastError instanceof Error ? lastError : new Error('Unable to reload player response');
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
