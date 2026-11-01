import type { VideoPlay } from '$lib/api/model';
import { SabrStreamingAdapter } from 'googlevideo/sabr-streaming-adapter';
import type shaka from 'shaka-player/dist/shaka-player.ui';
import { ShakaPlayerAdapter } from './ShakaPlayerAdapter';
import { Constants, YT } from 'youtubei.js';
import { get } from 'svelte/store';
import { poTokenCacheStore } from '$lib/store';
import { buildSabrFormat } from 'googlevideo/utils';
import { isUnrestrictedPlatform } from '$lib/misc';
import { mintPoToken } from '$lib/api/youtubejs/video';

/**
 * What the streaming side did lately - which token it streamed with, what it
 * fell back on, what a reload came back with - for a report of a failure to
 * say. Nothing in it identifies the account or carries a token.
 */
const trace: { at: number; what: string; [detail: string]: unknown }[] = [];

function note(what: string, detail: Record<string, unknown> = {}): void {
	trace.push({ at: Math.round(performance.now()), what, ...detail });
	if (trace.length > 30) trace.shift();
}

export function sabrTrace(): typeof trace {
	return trace.slice();
}

export async function injectSabr(
	video: VideoPlay,
	player: shaka.Player
): Promise<SabrStreamingAdapter | null> {
	if (!video.ytjs || !isUnrestrictedPlatform()) return null;

	// Primes BotGuard attestation state, without it SABR servers may
	// silently stop sending media mid-playback until the user seeks.
	// https://github.com/LuanRT/YouTube.js/issues/1121
	try {
		await video.ytjs.innertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
	} catch {
		// Continue regardless
	}

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

	trace.length = 0;
	const bindings = video.ytjs.streamingBindings ?? [];
	let bindingIndex = 0;
	let switching = false;

	note('start', {
		signedIn: video.ytjs.innertube.session.logged_in === true,
		playerToken: !!video.ytjs.playerPoToken,
		binding: bindings[0]?.kind ?? null,
		fallbacks: bindings.slice(1).map((binding) => binding.kind)
	});

	sabrAdapter.onMintPoToken(async () => {
		return get(poTokenCacheStore) || '';
	});

	// The streaming server says "sabr.malformed_config" when it will not take
	// the token, and says it again for every request after. Which binding a
	// signed-in session's token needs has changed under us more than once, so
	// rather than stopping a minute in, the next one is minted and every
	// request from then on carries it. The adapter asks for the token afresh
	// with each request, so nothing else has to be told.
	player.addEventListener('error', async (event) => {
		const detail = (event as CustomEvent).detail as { data?: unknown[] } | undefined;
		const info = detail?.data?.[1] as
			| { info?: { error?: { sabrError?: { type?: string } } } }
			| undefined;

		if (info?.info?.error?.sabrError?.type !== 'sabr.malformed_config') return;
		if (switching) return;

		const next = bindings[bindingIndex + 1];
		if (!next) {
			note('refused', { binding: bindings[bindingIndex]?.kind ?? null, noneLeft: true });
			return;
		}

		switching = true;
		note('refused', { binding: bindings[bindingIndex]?.kind ?? null, tryingNext: next.kind });

		try {
			poTokenCacheStore.set(await mintPoToken(next.value));
			bindingIndex++;
		} catch (error) {
			note('mintFailed', { binding: next.kind, error: String(error) });
			bindingIndex++;
		} finally {
			switching = false;
		}
	});

	sabrAdapter.onReloadPlayerResponse(async (reloadContext) => {
		if (!video.ytjs) return;

		// The streaming token is bound to the account, and is not what the
		// player is asked with.
		const ytjs = video.ytjs;

		const reload = async (poToken: string | undefined) => {
			const reloadedInfo = await ytjs.innertube.actions.execute('/player', {
				videoId: video.videoId,
				contentCheckOk: true,
				racyCheckOk: true,
				playbackContext: {
					contentPlaybackContext: {
						signatureTimestamp: ytjs.innertube.session.player?.signature_timestamp
					},
					reloadPlaybackContext: reloadContext
				},
				...(poToken ? { serviceIntegrityDimensions: { poToken } } : {})
			});

			const info = new YT.VideoInfo([reloadedInfo], ytjs.innertube.actions, ytjs.video.cpn);

			// A reload YouTube refused leaves nothing to stream with, and every
			// request after it fails the same way a refused token does.
			note('reload', {
				status: info.playability_status?.status ?? null,
				reason: info.playability_status?.reason ?? null,
				streamingUrl: !!info.streaming_data?.server_abr_streaming_url,
				config:
					!!info.player_config?.media_common_config.media_ustreamer_request_config
						?.video_playback_ustreamer_config,
				playerToken: !!poToken
			});

			return info;
		};

		// Asked again the way it was asked the first time; and if that comes
		// back with nothing to stream, once more the way it was asked before a
		// token was sent with it at all.
		let parsedInfo = await reload(ytjs.playerPoToken);
		if (!parsedInfo.streaming_data?.server_abr_streaming_url && ytjs.playerPoToken) {
			parsedInfo = await reload(undefined);
		}
		sabrAdapter.setStreamingURL(
			await video.ytjs.innertube.session.player!.decipher(
				parsedInfo.streaming_data?.server_abr_streaming_url
			)
		);
		// The reloaded response's own configuration, not the one playback
		// started with: the server asked for a reload because that one no
		// longer applies, and every request sent with it afterwards is refused
		// as "sabr.malformed_config".
		sabrAdapter.setUstreamerConfig(
			parsedInfo.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config ??
				video.ytjs.video.player_config?.media_common_config.media_ustreamer_request_config
					?.video_playback_ustreamer_config
		);
	});

	// Matches the manifest selection in $lib/api/youtubejs/video.ts: live content
	// without a manifest of its own is played from the adaptive formats like any
	// other video, so it needs the SABR configuration below rather than skipping it.
	const liveManifestUrl =
		video.ytjs.video.streaming_data?.dash_manifest_url ||
		video.ytjs.video.streaming_data?.hls_manifest_url;

	const isLive = video.ytjs.video.basic_info.is_live && !!liveManifestUrl;
	const isPostLiveDVR =
		!!liveManifestUrl &&
		(!!video.ytjs.video.basic_info.is_post_live_dvr ||
			!!video.ytjs.video.basic_info.is_live_content);

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
