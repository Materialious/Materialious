import shaka from 'shaka-player/dist/shaka-player.ui';
import { base64ToU8, Protos } from 'googlevideo';
import { Constants, type Misc } from 'youtubei.js';
import { HttpFetchPlugin, type SabrStreamingContext } from '$lib/sabr/shakaHttpPlugin';
import {
	fromFormat,
	fromFormatInitializationMetadata,
	fromMediaHeader,
	getUniqueFormatId
} from '$lib/sabr/formatKeyUtils';
import type { VideoPlay } from '$lib/api/model';
import { poTokenCacheStore } from '$lib/store';
import { get } from 'svelte/store';

export function injectSABR(
	player: shaka.Player,
	playerElement: HTMLMediaElement,
	video: VideoPlay
): ResizeObserver | undefined {
	if (!video.ytjs) return;

	shaka.net.NetworkingEngine.registerScheme(
		'http',
		HttpFetchPlugin.parse,
		shaka.net.NetworkingEngine.PluginPriority.PREFERRED
	);
	shaka.net.NetworkingEngine.registerScheme(
		'https',
		HttpFetchPlugin.parse,
		shaka.net.NetworkingEngine.PluginPriority.PREFERRED
	);

	const sessionId = Array.from(Array(16), () => Math.floor(Math.random() * 36).toString(36)).join(
		''
	);
	let videoPlaybackUstreamerConfig: string | undefined;
	let serverAbrStreamingUrl: URL | undefined = undefined;
	let drmParams: string | undefined;
	const lastRequestMs = 0;
	let lastSeekMs = 0;
	let lastManualFormatSelectionMs = 0;
	let lastActionMs = 0;
	let clientViewportHeight = playerElement?.clientHeight || 0;
	let clientViewportWidth = playerElement?.clientWidth || 0;
	let lastPlaybackCookie: Protos.PlaybackCookie | undefined;
	const initializedFormats = new Map<
		string,
		{
			lastSegmentMetadata?: {
				formatId: Protos.FormatId;
				startTimeMs: number;
				startSequenceNumber: number;
				endSequenceNumber: number;
				durationMs: number;
			};
			formatInitializationMetadata: Protos.FormatInitializationMetadata;
		}
	>();
	let formatList: Misc.Format[] = [];

	const playerElementResizeObserver = new ResizeObserver(() => {
		if (playerElement) {
			clientViewportHeight = playerElement.clientHeight;
			clientViewportWidth = playerElement.clientWidth;
		}
	});

	playerElementResizeObserver?.observe(playerElement);

	if (
		video.ytjs.rawApiResponse.data.streamingData &&
		(video.ytjs.rawApiResponse.data.streamingData as any).drmParams
	) {
		drmParams = (video.ytjs.rawApiResponse.data.streamingData as any).drmParams;
		player.configure({
			drm: {
				servers: {
					'com.widevine.alpha':
						'https://www.youtube.com/youtubei/v1/player/get_drm_license?alt=json'
				}
			}
		});
	}

	videoPlaybackUstreamerConfig =
		video.ytjs.video.page[0].player_config?.media_common_config.media_ustreamer_request_config
			?.video_playback_ustreamer_config;

	if (video.ytjs.video.streaming_data) {
		formatList = video.ytjs.video.streaming_data.adaptive_formats;
	}

	if (video.ytjs.video.streaming_data?.server_abr_streaming_url)
		serverAbrStreamingUrl = new URL(
			video.ytjs.innertube.session.player!.decipher(
				video.ytjs.video.streaming_data.server_abr_streaming_url
			)
		);

	playerElement.addEventListener('seeked', () => (lastSeekMs = Date.now()));

	player.addEventListener('variantchanged', (event) => {
		// Technically, all variant changes here are manual, given we don't handle ABR updates from the server.
		if (event.type !== 'variant') {
			lastManualFormatSelectionMs = Date.now();
		}

		lastActionMs = Date.now();
	});

	const networkingEngine = player.getNetworkingEngine();

	if (!networkingEngine) return;

	// Based off the following
	// https://github.com/FreeTubeApp/FreeTube/blob/d270c9e251a433f1e4246a3f6a37acef707d22aa/src/renderer/components/ft-shaka-video-player/ft-shaka-video-player.js#L1206
	// https://github.com/LuanRT/BgUtils/blob/6b121166be1ccb0b952dee1bdac488808365ae6b/examples/browser/web/src/main.ts#L293
	// https://github.com/LuanRT/yt-sabr-shaka-demo/blob/main/src/components/VideoPlayer.vue
	networkingEngine.registerRequestFilter(async (type, request, context) => {
		if (!player) return;

		const originalUrl = new URL(request.uris[0]);
		const url = originalUrl.hostname === 'sabr' ? serverAbrStreamingUrl : originalUrl;
		const headers = request.headers;

		if (!url) return;

		if (
			type === shaka.net.NetworkingEngine.RequestType.SEGMENT &&
			url.pathname.includes('videoplayback')
		) {
			if (!video.liveNow) {
				const currentFormat = formatList.find(
					(format) =>
						fromFormat(format) === (new URL(request.uris[0]).searchParams.get('___key') || '')
				);

				if (!videoPlaybackUstreamerConfig) throw new Error('Ustreamer config not found.');

				if (!currentFormat) throw new Error('No format found for SABR request.');

				if (!playerElement) throw new Error('No video element found.');

				const activeVariant = player
					.getVariantTracks()
					.find(
						(track) =>
							getUniqueFormatId(currentFormat) ===
							(currentFormat.has_video ? track.originalVideoId : track.originalAudioId)
					);

				let videoFormat: Misc.Format | undefined;
				let audioFormat: Misc.Format | undefined;
				let videoFormatId: Protos.FormatId | undefined;
				let audioFormatId: Protos.FormatId | undefined;

				if (activeVariant) {
					for (const fmt of formatList) {
						const uniqueFormatId = getUniqueFormatId(fmt);
						if (uniqueFormatId === activeVariant.originalVideoId) {
							videoFormat = fmt;
						} else if (uniqueFormatId === activeVariant.originalAudioId) {
							audioFormat = fmt;
						}
					}
				}

				if (videoFormat) {
					videoFormatId = {
						itag: videoFormat.itag,
						lastModified: parseInt(videoFormat.last_modified_ms),
						xtags: videoFormat.xtags
					};
				}

				if (audioFormat) {
					audioFormatId = {
						itag: audioFormat.itag,
						lastModified: parseInt(audioFormat.last_modified_ms),
						xtags: audioFormat.xtags
					};
				}

				const isInit = context ? !context.segment : true;

				const videoPlaybackAbrRequest: Protos.VideoPlaybackAbrRequest = {
					clientAbrState: {
						playbackRate: player.getPlaybackRate(),
						playerTimeMs: Math.round(
							(context?.segment?.getStartTime() ?? playerElement.currentTime) * 1000
						),
						elapsedWallTimeMs: Date.now() - lastRequestMs,
						timeSinceLastSeek: lastSeekMs === 0 ? 0 : Date.now() - lastSeekMs,
						timeSinceLastActionMs: lastActionMs === 0 ? 0 : Date.now() - lastActionMs,
						timeSinceLastManualFormatSelectionMs:
							lastManualFormatSelectionMs === 0 ? 0 : Date.now() - lastManualFormatSelectionMs,
						clientViewportIsFlexible: false,
						bandwidthEstimate: Math.round(player.getStats().estimatedBandwidth),
						drcEnabled: currentFormat.is_drc === true,
						enabledTrackTypesBitfield: currentFormat.has_audio ? 1 : 2,
						clientViewportHeight,
						clientViewportWidth
					},
					bufferedRanges: [],
					selectedFormatIds: [],
					selectedAudioFormatIds: [audioFormatId || {}],
					selectedVideoFormatIds: [videoFormatId || {}],
					videoPlaybackUstreamerConfig: base64ToU8(videoPlaybackUstreamerConfig),
					streamerContext: {
						poToken: base64ToU8(get(poTokenCacheStore) ?? ''),
						playbackCookie: lastPlaybackCookie
							? Protos.PlaybackCookie.encode(lastPlaybackCookie).finish()
							: undefined,
						clientInfo: {
							clientName: parseInt(Constants.CLIENT_NAME_IDS.WEB),
							clientVersion: video.ytjs?.innertube.session.context.client.clientVersion,
							osName: 'Windows',
							osVersion: '10.0'
						},
						field5: [],
						field6: []
					},
					field1000: []
				};

				// Normalize the resolution.
				if (currentFormat.width && currentFormat.height) {
					let resolution = currentFormat.height;

					const aspectRatio = currentFormat.height / currentFormat.width;

					if (aspectRatio > 16 / 9) {
						resolution = Math.round((currentFormat.width * 9) / 16);
					}

					if (resolution && videoPlaybackAbrRequest.clientAbrState) {
						videoPlaybackAbrRequest.clientAbrState.stickyResolution = resolution;
						videoPlaybackAbrRequest.clientAbrState.lastManualSelectedResolution = resolution;
					}
				}

				if (!isInit) {
					// Add the currently/previously active formats to the list of buffered ranges and selected formats
					// so that the server doesn't send its init data again.
					const initializedFormatsArray = Array.from(initializedFormats.values());

					for (const initializedFormat of initializedFormatsArray) {
						if (initializedFormat.lastSegmentMetadata) {
							videoPlaybackAbrRequest.bufferedRanges.push({
								formatId: initializedFormat.lastSegmentMetadata.formatId,
								startSegmentIndex: initializedFormat.lastSegmentMetadata.startSequenceNumber,
								durationMs: initializedFormat.lastSegmentMetadata.durationMs,
								startTimeMs: 0,
								endSegmentIndex: initializedFormat.lastSegmentMetadata.endSequenceNumber
							});
						}
					}

					if (audioFormatId) videoPlaybackAbrRequest.selectedFormatIds.push(audioFormatId);

					if (videoFormatId) videoPlaybackAbrRequest.selectedFormatIds.push(videoFormatId);
				}

				request.body = Protos.VideoPlaybackAbrRequest.encode(videoPlaybackAbrRequest).finish();

				const byteRange = headers.Range
					? {
							start: Number(headers.Range.split('=')[1].split('-')[0]),
							end: Number(headers.Range.split('=')[1].split('-')[1])
						}
					: null;

				const sabrStreamingContext = {
					byteRange,
					format: currentFormat,
					isInit,
					isUMP: true,
					isSABR: true,
					playerTimeMs: videoPlaybackAbrRequest.clientAbrState?.playerTimeMs
				};

				// @NOTE: Not a real header. See the http plugin code for more info.
				request.headers['X-Streaming-Context'] = btoa(JSON.stringify(sabrStreamingContext));
				delete headers.Range;
			} else {
				url.pathname += `/ump/1/srfvp/1/pot/${get(poTokenCacheStore)}`;

				request.headers['X-Streaming-Context'] = btoa(
					JSON.stringify({
						isUMP: true,
						isSABR: false
					})
				);
			}

			request.method = 'POST';
		} else if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
			const wrapped = {} as Record<string, any>;
			wrapped.context = video.ytjs?.innertube.session.context;
			wrapped.cpn = video.ytjs?.clientPlaybackNonce;
			wrapped.drmParams = decodeURIComponent(drmParams || '');
			wrapped.drmSystem = 'DRM_SYSTEM_WIDEVINE';
			wrapped.drmVideoFeature = 'DRM_VIDEO_FEATURE_SDR';
			wrapped.licenseRequest = shaka.util.Uint8ArrayUtils.toBase64(
				request.body as ArrayBuffer | ArrayBufferView
			);
			wrapped.sessionId = sessionId;
			wrapped.videoId = video.videoId;
			request.body = shaka.util.StringUtils.toUTF8(JSON.stringify(wrapped));
		}

		request.uris[0] = url.toString();
	});

	networkingEngine.registerResponseFilter(async (type, response, context) => {
		if (type === shaka.net.NetworkingEngine.RequestType.SEGMENT) {
			const url = new URL(response.uri);
			if (
				url.hostname.endsWith('.youtube.com') &&
				url.pathname === '/api/timedtext' &&
				url.searchParams.get('caps') === 'asr' &&
				url.searchParams.get('kind') === 'asr' &&
				url.searchParams.get('fmt') === 'vtt'
			) {
				const stringBody = new TextDecoder().decode(response.data);
				// position:0% for LTR text and position:100% for RTL text
				const cleaned = stringBody.replaceAll(/ align:start position:(?:10)?0%$/gm, '');

				/* @ts-ignore */
				response.data = new TextEncoder().encode(cleaned).buffer;
			} else {
				const sabrStreamingContext = response.headers['X-Streaming-Context'];

				if (sabrStreamingContext) {
					const { streamInfo, format, byteRange } = JSON.parse(
						atob(sabrStreamingContext)
					) as SabrStreamingContext;

					if (streamInfo) {
						const sabrRedirect = streamInfo.redirect;
						const playbackCookie = streamInfo.playbackCookie;
						const streamProtectionStatus = streamInfo.streamProtectionStatus;
						const formatInitMetadata = streamInfo.formatInitMetadata || [];
						const mainSegmentMediaHeader = streamInfo.mediaHeader;

						// If we have a redirect, follow it.
						if (sabrRedirect?.url && !response.data.byteLength) {
							let redirectUrl = new URL(sabrRedirect.url);

							serverAbrStreamingUrl = redirectUrl;
							redirectUrl = new URL(`https://sabr?___key=${fromFormat(format) || ''}`);

							const retryParameters = player!.getConfiguration().streaming.retryParameters;

							const redirectRequest = shaka.net.NetworkingEngine.makeRequest(
								[redirectUrl.toString()],
								retryParameters
							);

							// Keep range so we can slice the response (only if it's the init segment).
							if (typeof byteRange !== 'undefined') {
								redirectRequest.headers['Range'] = `bytes=${byteRange.start}-${byteRange.end}`;
							}

							const requestOperation = player!
								.getNetworkingEngine()
								?.request(type, redirectRequest, context);
							const redirectResponse = await requestOperation!.promise;

							// Modify the original response to contain the results of the redirect
							// response.
							Object.assign(response, redirectResponse);
							return;
						}

						if (playbackCookie) lastPlaybackCookie = streamInfo.playbackCookie;

						if (streamProtectionStatus && streamProtectionStatus.status === 3) {
							console.warn('[UMP] Attestation required.');
						}

						for (const metadata of formatInitMetadata) {
							const key = fromFormatInitializationMetadata(metadata);
							if (!initializedFormats.has(key)) {
								initializedFormats.set(key, {
									formatInitializationMetadata: metadata
								});
								console.log(`[SABR] Initialized format ${key}`);
							}
						}

						if (mainSegmentMediaHeader) {
							const formatKey = fromMediaHeader(mainSegmentMediaHeader);
							const initializedFormat = initializedFormats.get(formatKey);

							if (initializedFormat) {
								initializedFormat.lastSegmentMetadata = {
									formatId: mainSegmentMediaHeader.formatId!,
									startTimeMs: mainSegmentMediaHeader.startMs || 0,
									startSequenceNumber: mainSegmentMediaHeader.sequenceNumber || 1,
									endSequenceNumber: mainSegmentMediaHeader.sequenceNumber || 1,
									durationMs: mainSegmentMediaHeader.durationMs || 0
								};
							}
						}
					}
				}
			}
		} else if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
			const wrappedString = shaka.util.StringUtils.fromUTF8(response.data);
			const wrapped = JSON.parse(wrappedString);
			const rawLicenseBase64 = wrapped.license;
			response.data = shaka.util.Uint8ArrayUtils.fromBase64(rawLicenseBase64);
		}
	});

	return playerElementResizeObserver;
}
