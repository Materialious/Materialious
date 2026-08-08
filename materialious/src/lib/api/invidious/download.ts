import { getPublicEnv } from '$lib/misc';
import type { AdaptiveFormats, VideoPlay } from '$lib/api/model';
import { sanitizeFilename } from '@materialious/shared';
import type { SabrFormat } from '@materialious/shared/download';
import type {
	AvailableFormats,
	DownloadResult,
	DownloadSelection
} from '$lib/api/youtubejs/download';

export function getCompanionInstance(): string | undefined {
	return getPublicEnv('DEFAULT_COMPANION_INSTANCE');
}

export function isCompanionAvailable(): boolean {
	return !!getCompanionInstance();
}

export function getCompanionFormats(video: VideoPlay): AvailableFormats {
	return { title: video.title, formats: deriveCompanionFormats(video) };
}

export function startCompanionDownload(
	video: VideoPlay,
	selection: DownloadSelection
): DownloadResult {
	const companion = getCompanionInstance();
	if (!companion) {
		throw new Error('Downloads are not supported in this environment');
	}

	const resolved = resolveCompanionFormat(video, selection);

	if (!resolved) {
		throw new Error('No compatible format found');
	}

	const params = new URLSearchParams({
		id: video.videoId,
		itag: resolved.itag.toString(),
		local: 'true',
		title: `${sanitizeFilename(video.title)}-${video.videoId}.${resolved.ext}`
	});

	window.open(`${companion}/latest_version?${params.toString()}`, '_blank', 'noopener');

	return {};
}

function deriveCompanionFormats(video: VideoPlay): SabrFormat[] {
	return video.adaptiveFormats.map((format) => ({
		itag: Number(format.itag) || 0,
		mimeType: format.type.split(';')[0].trim(),
		codec: null,
		container: extOf(format.type),
		qualityLabel: formatQualityLabel(format),
		height: formatHeight(format) || undefined,
		bitrate: Number(format.bitrate) || 0,
		hasAudio: format.type.startsWith('audio/'),
		hasVideo: format.type.startsWith('video/'),
		hasText: false
	}));
}

function resolveCompanionFormat(
	video: VideoPlay,
	selection: DownloadSelection
): { itag: number; ext: string } | null {
	const isAudio = selection.type === 'audio';

	if (selection.itag) {
		const exact = video.adaptiveFormats.find((format) => Number(format.itag) === selection.itag);
		if (exact) {
			return { itag: selection.itag, ext: extOf(exact.type) };
		}
	}

	const candidates = video.adaptiveFormats.filter((format) =>
		isAudio ? format.type.startsWith('audio/') : format.type.startsWith('video/')
	);

	if (candidates.length === 0) return null;

	let selected: AdaptiveFormats;
	if (isAudio) {
		selected = [...candidates].sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
	} else {
		const qualityMatch = selection.quality
			? candidates.find((format) => formatQualityLabel(format) === selection.quality)
			: undefined;
		selected = qualityMatch ?? [...candidates].sort((a, b) => formatHeight(b) - formatHeight(a))[0];
	}

	return { itag: Number(selected.itag), ext: extOf(selected.type) };
}

function extOf(type: string): string {
	return type.split(';')[0].trim().split('/')[1] || 'mp4';
}

function formatHeight(format: AdaptiveFormats): number {
	if (format.qualityLabel) {
		const match = format.qualityLabel.match(/(\d+)p/);
		if (match) return parseInt(match[1], 10);
	}
	if (format.resolution) {
		const height = format.resolution.split('x')[1];
		if (height) return parseInt(height, 10);
	}
	return 0;
}

function formatQualityLabel(format: AdaptiveFormats): string | undefined {
	if (format.qualityLabel) return format.qualityLabel;
	const height = formatHeight(format);
	return height ? `${height}p` : undefined;
}
