import { Constants, Mixins, YT } from 'youtubei.js';
import { SabrStream as GoogleSabrStream } from 'googlevideo/sabr-stream';
import { buildSabrFormat, EnabledTrackTypes } from 'googlevideo/utils';
import type { SabrFormat as GoogleSabrFormat } from 'googlevideo/shared-types';
import type { AudioFormatPreferences, VideoFormatPreferences } from 'googlevideo/sabr-stream';
import { buildSabrFormat as buildSharedSabrFormat } from './buildSabrFormat.js';
import type { DownloadFormatSelection, SabrFormat } from './types.js';

export type SabrDownloadResult = {
	stream: ReadableStream<Uint8Array>;
	format: GoogleSabrFormat;
};

export type SabrDownloadBothResult = {
	videoStream: ReadableStream<Uint8Array>;
	audioStream: ReadableStream<Uint8Array>;
	videoFormat: GoogleSabrFormat;
	audioFormat: GoogleSabrFormat;
};

function toByteStream(
	stream: ReadableStream<ArrayBufferView<ArrayBufferLike>>
): ReadableStream<Uint8Array> {
	return stream.pipeThrough(
		new TransformStream<ArrayBufferView<ArrayBufferLike>, Uint8Array>({
			transform(chunk, controller) {
				controller.enqueue(
					chunk instanceof Uint8Array
						? chunk
						: new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
				);
			}
		})
	);
}

function parseAudioQuality(
	quality: string | undefined
): AudioFormatPreferences['quality'] | undefined {
	if (!quality) return undefined;

	const normalized = quality.toUpperCase();
	if (normalized.startsWith('AUDIO_QUALITY_')) {
		return normalized as AudioFormatPreferences['quality'];
	}

	return `AUDIO_QUALITY_${normalized}` as AudioFormatPreferences['quality'];
}

export class SabrStream {
	constructor(public readonly media: Mixins.MediaInfo) {}

	getFormats(): SabrFormat[] {
		const formats: SabrFormat[] = [];
		const streamingData = this.media.streaming_data;

		if (!streamingData) return formats;

		for (const format of streamingData.formats ?? []) {
			formats.push(buildSharedSabrFormat(format));
		}

		for (const format of streamingData.adaptive_formats ?? []) {
			formats.push(buildSharedSabrFormat(format));
		}

		return formats;
	}

	getTitle(): string {
		return this.media.basic_info.title ?? '';
	}

	private getClientInfo() {
		const client = this.media.actions.session.context.client;

		return {
			osName: client.osName,
			osVersion: client.osVersion,
			clientName: parseInt(
				Constants.CLIENT_NAME_IDS[client.clientName as keyof typeof Constants.CLIENT_NAME_IDS]
			),
			clientVersion: client.clientVersion
		};
	}

	private isPostLiveDvr(): boolean {
		const basicInfo = this.media.basic_info;
		const streamingData = this.media.streaming_data;

		return (
			!!basicInfo.is_post_live_dvr ||
			(!!basicInfo.is_live_content &&
				!!(streamingData?.dash_manifest_url || streamingData?.hls_manifest_url))
		);
	}

	private async createGoogleStream(): Promise<GoogleSabrStream> {
		const actions = this.media.actions;
		const session = actions.session;
		const streamingData = this.media.streaming_data;
		const videoId = this.media.basic_info.id;

		if (!videoId) {
			throw new Error('Video ID is required for SABR downloads');
		}

		if (!streamingData?.server_abr_streaming_url) {
			throw new Error('Streaming data is required for SABR downloads');
		}

		if (!session.player) {
			throw new Error('Player script is required for SABR downloads');
		}

		const serverAbrStreamingUrl = await session.player.decipher(
			streamingData.server_abr_streaming_url
		);

		const videoPlaybackUstreamerConfig =
			this.media.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config;

		if (!serverAbrStreamingUrl || !videoPlaybackUstreamerConfig) {
			throw new Error('SABR streaming information is missing');
		}

		return new GoogleSabrStream({
			videoId,
			serverAbrStreamingUrl,
			videoPlaybackUstreamerConfig,
			formats: (streamingData.adaptive_formats ?? []).map(buildSabrFormat),
			clientInfo: this.getClientInfo(),
			poToken: session.po_token,
			callbacks: {
				onReloadPlayerResponse: async (reloadContext) => {
					const reloadedInfo = await actions.execute('/player', {
						videoId,
						contentCheckOk: true,
						racyCheckOk: true,
						playbackContext: {
							contentPlaybackContext: {
								signatureTimestamp: session.player?.signature_timestamp
							},
							reloadPlaybackContext: reloadContext
						}
					});

					const parsedInfo = new YT.VideoInfo([reloadedInfo], actions, this.media.cpn);
					const reloadedStreamingUrl = await session.player?.decipher(
						parsedInfo.streaming_data?.server_abr_streaming_url
					);
					const reloadedUstreamerConfig =
						parsedInfo.player_config?.media_common_config.media_ustreamer_request_config
							?.video_playback_ustreamer_config;

					if (!reloadedStreamingUrl || !reloadedUstreamerConfig) {
						throw new Error('Reloaded SABR streaming information is missing');
					}

					return {
						serverAbrStreamingUrl: reloadedStreamingUrl,
						videoPlaybackUstreamerConfig: reloadedUstreamerConfig
					};
				}
			}
		});
	}

	private getPreferenceOptions(selection: Pick<DownloadFormatSelection, 'format' | 'codec'>): {
		videoPreferences: VideoFormatPreferences;
		audioPreferences: AudioFormatPreferences;
	} {
		const format = selection.format?.toLowerCase() ?? '';
		const codec = selection.codec?.toLowerCase() ?? '';

		const wantsWebm = format.includes('webm') || format.includes('mkv');
		const wantsMp4 = format.includes('mp4') || format.includes('m4a') || format.includes('m4v');
		const container = wantsWebm ? 'webm' : wantsMp4 ? 'mp4' : undefined;

		const preferredVideoCodec =
			codec.includes('avc') || codec.includes('h264')
				? 'h264'
				: codec.includes('vp9') || codec.includes('vp09')
					? 'vp9'
					: codec.includes('av01') || codec.includes('av1')
						? 'av1'
						: undefined;

		const preferredAudioCodec =
			codec.includes('opus') || (!wantsMp4 && wantsWebm)
				? 'opus'
				: codec.includes('mp4a') || codec.includes('aac') || (!wantsWebm && wantsMp4)
					? 'aac'
					: undefined;

		return {
			videoPreferences: { container, preferredVideoCodec },
			audioPreferences: { container, preferredAudioCodec }
		};
	}

	async download(selection: DownloadFormatSelection): Promise<SabrDownloadResult> {
		const type = selection.type === 'merged' ? 'video+audio' : selection.type;
		const isAudio = type === 'audio';
		const preferences = this.getPreferenceOptions(selection);

		const stream = await this.createGoogleStream();
		const { videoStream, audioStream, selectedFormats } = stream.start({
			enabledTrackTypes: isAudio ? EnabledTrackTypes.AUDIO_ONLY : EnabledTrackTypes.VIDEO_ONLY,
			isPostLiveDvr: this.isPostLiveDvr(),
			videoPreferences: {
				...preferences.videoPreferences,
				...(isAudio ? {} : { quality: selection.quality })
			},
			audioPreferences: {
				...preferences.audioPreferences,
				...(isAudio
					? {
							quality: parseAudioQuality(selection.quality),
							...(selection.language ? { language: selection.language } : {})
						}
					: {})
			},
			...(isAudio ? { audioFormat: selection.itag } : { videoFormat: selection.itag })
		});

		const format = isAudio ? selectedFormats.audioFormat : selectedFormats.videoFormat;

		if (!format) {
			throw new Error(`No ${isAudio ? 'audio' : 'video'} format was selected`);
		}

		return {
			stream: toByteStream(isAudio ? audioStream : videoStream),
			format
		};
	}

	async downloadBoth(
		selection: Pick<DownloadFormatSelection, 'quality' | 'itag' | 'format' | 'codec' | 'language'>
	): Promise<SabrDownloadBothResult> {
		const preferences = this.getPreferenceOptions(selection);
		const stream = await this.createGoogleStream();
		const { videoStream, audioStream, selectedFormats } = stream.start({
			enabledTrackTypes: EnabledTrackTypes.VIDEO_AND_AUDIO,
			isPostLiveDvr: this.isPostLiveDvr(),
			videoPreferences: {
				...preferences.videoPreferences,
				quality: selection.quality
			},
			audioPreferences: {
				...preferences.audioPreferences,
				...(selection.language ? { language: selection.language } : {})
			},
			...(selection.itag ? { audioFormat: selection.itag } : {})
		});

		if (!selectedFormats.videoFormat) {
			throw new Error('No video format was selected');
		}

		return {
			videoStream: toByteStream(videoStream),
			audioStream: toByteStream(audioStream),
			videoFormat: selectedFormats.videoFormat,
			audioFormat: selectedFormats.audioFormat
		};
	}
}
