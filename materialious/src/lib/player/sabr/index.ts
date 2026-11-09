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

function usesManifestPlayback(video: VideoPlay): boolean {
	const info = video.ytjs?.video;
	return !!(
		video.liveNow ||
		info?.basic_info.is_live ||
		info?.basic_info.is_post_live_dvr ||
		(info?.basic_info.is_live_content &&
			(info.streaming_data?.dash_manifest_url || info.streaming_data?.hls_manifest_url))
	);
}

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
	if (!video.ytjs || usesManifestPlayback(video)) return;
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

		// Do not leave a rejected token available if minting fails. A failed
		// refresh must propagate and must not start the success cooldown.
		if (get(poTokenCacheStore)?.videoId === video.videoId) poTokenCacheStore.set(undefined);
		await mintPoTokenForVideo(video.videoId);

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
	player: shaka.Player,
	signal?: AbortSignal
): Promise<SabrStreamingAdapter | null> {
	// Live and post-live DVR manifests go straight through Shaka. Do not
	// rewrite their media GETs into SABR/UMP POSTs or start SABR recovery.
	if (signal?.aborted || !video.ytjs || !isUnrestrictedPlatform() || usesManifestPlayback(video))
		return null;

	await primeSabrAttestation(video);
	if (signal?.aborted) return null;

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

	let lastProtectionStatus: number | undefined;
	shakaPlayerAdapter.setStreamProtectionHandler(async (status) => {
		if (status !== lastProtectionStatus) {
			// Status 2 is provisional access; receiving initial media does not
			// prove that YouTube accepted the token. Log no token or signed URL.
			console.debug('[SABR] Stream protection status:', status);
			lastProtectionStatus = status;
		}
		if (status === 3) {
			console.warn('[SABR] Server requested attestation, refreshing PoToken');
			await refreshSabrSession(video);
		}
	});

	let pendingMint: Promise<string> | undefined;
	sabrAdapter.onMintPoToken(async () => {
		// Requests built while protection recovery runs must use its new token.
		if (poTokenRefresh?.videoId === video.videoId) await poTokenRefresh.promise;
		const cached = get(poTokenCacheStore);
		if (cached?.videoId === video.videoId) return cached.poToken;

		// Let Shaka retry a mint failure instead of sending an unauthenticated
		// request, which can use up the server's protection retry budget.
		// Audio and video can request their next segment simultaneously.
		pendingMint ??= mintPoTokenForVideo(video.videoId);
		try {
			return await pendingMint;
		} finally {
			pendingMint = undefined;
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

	if (video.ytjs.video.streaming_data) {
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

	if (signal?.aborted) {
		sabrAdapter.dispose();
		return null;
	}
	sabrAdapter.attach(player);

	return sabrAdapter;
}
