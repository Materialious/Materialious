import { Constants, Mixins } from 'youtubei.js';
import { SabrStream as GoogleSabrStream } from 'googlevideo/sabr-stream';
import { buildSabrFormat, EnabledTrackTypes } from 'googlevideo/utils';
import type { SabrFormat as GoogleSabrFormat } from 'googlevideo/shared-types';
import type { SabrPlaybackOptions } from 'googlevideo/sabr-stream';
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

	private async createGoogleStream(): Promise<GoogleSabrStream> {
		const session = this.media.actions.session;
		const sabrFormats = (this.media.streaming_data?.adaptive_formats ?? []).map(buildSabrFormat);

		const stream = new GoogleSabrStream({
			formats: sabrFormats,
			clientInfo: this.getClientInfo(),
			poToken: session.po_token,
			durationMs: this.media.basic_info.duration ? this.media.basic_info.duration * 1000 : undefined
		});

		if (this.media.streaming_data?.server_abr_streaming_url) {
			if (!session.player) {
				throw new Error('Player script is required for SABR downloads');
			}

			stream.setStreamingURL(
				await session.player.decipher(this.media.streaming_data.server_abr_streaming_url)
			);
		}

		const ustreamerConfig =
			this.media.player_config?.media_common_config.media_ustreamer_request_config
				?.video_playback_ustreamer_config;

		if (ustreamerConfig) {
			stream.setUstreamerConfig(ustreamerConfig);
		}

		return stream;
	}

	private getPreferenceOptions(
		selection: Pick<DownloadFormatSelection, 'format' | 'codec'>
	): Pick<SabrPlaybackOptions, 'preferH264' | 'preferMP4' | 'preferWebM' | 'preferOpus'> {
		const format = selection.format?.toLowerCase() ?? '';
		const codec = selection.codec?.toLowerCase() ?? '';

		const wantsMp4 = format.includes('mp4') || codec.includes('avc') || codec.includes('mp4a');
		const wantsWebm =
			format.includes('webm') ||
			codec.includes('vp8') ||
			codec.includes('vp9') ||
			codec.includes('vp09') ||
			codec.includes('av01') ||
			codec.includes('opus') ||
			codec.includes('vorbis');

		return {
			preferH264: wantsMp4,
			preferMP4: wantsMp4,
			preferWebM: wantsWebm,
			preferOpus: wantsWebm
		};
	}

	async download(selection: DownloadFormatSelection): Promise<SabrDownloadResult> {
		const type = selection.type === 'merged' ? 'video+audio' : selection.type;
		const isAudio = type === 'audio';

		const stream = await this.createGoogleStream();
		const { videoStream, audioStream, selectedFormats } = await stream.start({
			enabledTrackTypes: isAudio ? EnabledTrackTypes.AUDIO_ONLY : EnabledTrackTypes.VIDEO_ONLY,
			...(isAudio
				? { audioFormat: selection.itag, audioQuality: selection.quality }
				: { videoFormat: selection.itag, videoQuality: selection.quality }),
			...(selection.language ? { audioLanguage: selection.language } : {}),
			...this.getPreferenceOptions(selection)
		});

		return {
			stream: isAudio ? audioStream : videoStream,
			format: isAudio ? selectedFormats.audioFormat : selectedFormats.videoFormat
		};
	}

	async downloadBoth(
		selection: Pick<DownloadFormatSelection, 'quality' | 'itag' | 'format' | 'codec' | 'language'>
	): Promise<SabrDownloadBothResult> {
		const stream = await this.createGoogleStream();
		const { videoStream, audioStream, selectedFormats } = await stream.start({
			enabledTrackTypes: EnabledTrackTypes.VIDEO_AND_AUDIO,
			videoQuality: selection.quality,
			...(selection.itag ? { audioFormat: selection.itag } : {}),
			...(selection.language ? { audioLanguage: selection.language } : {}),
			...this.getPreferenceOptions(selection)
		});

		return {
			videoStream,
			audioStream,
			videoFormat: selectedFormats.videoFormat,
			audioFormat: selectedFormats.audioFormat
		};
	}
}
