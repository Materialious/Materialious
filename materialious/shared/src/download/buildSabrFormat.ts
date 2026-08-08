import { Misc } from 'youtubei.js';
import type { SabrFormat } from './types.js';

function getCodec(mimeType: string): string | null {
	const codecsMatch = mimeType.match(/codecs="([^"]+)"/);
	return codecsMatch ? codecsMatch[1] : null;
}

function getContainer(mimeType: string): string {
	const containerMatch = mimeType.match(/^[^/]+\/([^;]+)/);
	return containerMatch ? containerMatch[1] : 'unknown';
}

export function buildSabrFormat(format: Misc.Format): SabrFormat {
	return {
		itag: format.itag,
		mimeType: format.mime_type,
		codec: getCodec(format.mime_type),
		container: getContainer(format.mime_type),
		url: format.url,
		qualityLabel: format.quality_label,
		width: format.width,
		height: format.height,
		fps: format.fps,
		bitrate: format.bitrate,
		contentLength: format.content_length,
		hasAudio: format.has_audio,
		hasVideo: format.has_video,
		hasText: format.has_text,
		audioQuality: format.audio_quality,
		audioChannels: format.audio_channels,
		audioSampleRate: format.audio_sample_rate,
		approxDurationMs: format.approx_duration_ms,
		projectionType: format.projection_type,
		language: format.language
	};
}
