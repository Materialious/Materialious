import { sanitizeFilename } from '../filename.js';
import { inferMergeContainer, mergeStreams } from './ffmpeg.js';
import { SabrStream } from './SabrStream.js';
import type { MergeContainer } from './types.js';

export type ResolvedDownload = {
	type: 'raw' | 'merged';
	stream: ReadableStream<Uint8Array>;
	container: string;
	mimeType: string;
	filename: string;
	size?: number;
	close?: () => Promise<void>;
};

export type CreateDownloadOptions = {
	media: import('youtubei.js').Mixins.MediaInfo;
	selection: import('./types.js').DownloadFormatSelection;
	onProgress?: (progress: number) => void;
	abortSignal?: AbortSignal;
};

function mimeTypeForContainer(container: string): string {
	switch (container) {
		case 'mp4':
			return 'video/mp4';
		case 'webm':
			return 'video/webm';
		case 'mkv':
			return 'video/x-matroska';
		default:
			return 'application/octet-stream';
	}
}

function getContainer(mimeType?: string): string {
	return mimeType?.match(/^[^/]+\/([^;]+)/)?.[1] ?? 'mp4';
}

export async function createDownload(options: CreateDownloadOptions): Promise<ResolvedDownload> {
	const { media, selection, onProgress, abortSignal } = options;

	const sabr = new SabrStream(media);
	const title = sabr.getTitle();
	const durationMs = media.basic_info.duration ? media.basic_info.duration * 1000 : undefined;

	if (abortSignal?.aborted) {
		throw new Error('Download aborted');
	}

	if (selection.type === 'audio') {
		const { stream, format } = await sabr.download(selection);
		const container = getContainer(format.mimeType);

		return {
			type: 'raw',
			stream,
			container,
			mimeType: format.mimeType ?? 'audio/mp4',
			filename: `${sanitizeFilename(title)}.${container}`
		};
	}

	if (selection.type === 'video') {
		const { stream, format } = await sabr.download(selection);
		const container = getContainer(format.mimeType);

		return {
			type: 'raw',
			stream,
			container,
			mimeType: format.mimeType ?? 'video/mp4',
			filename: `${sanitizeFilename(title)}.${container}`
		};
	}

	// 'video+audio' or 'merged': download both tracks and merge them.
	const { videoStream, audioStream, videoFormat, audioFormat } = await sabr.downloadBoth(selection);
	const container: MergeContainer = inferMergeContainer(videoFormat, audioFormat);

	const totalBytes =
		videoFormat.contentLength && audioFormat.contentLength
			? videoFormat.contentLength + audioFormat.contentLength
			: undefined;

	const merged = await mergeStreams({
		videoStream,
		audioStream,
		container,
		durationMs,
		totalBytes,
		onProgress,
		abortSignal
	});

	return {
		type: 'merged',
		stream: merged.stream,
		container,
		mimeType: mimeTypeForContainer(container),
		filename: `${sanitizeFilename(title)}.${container}`,
		close: merged.close
	};
}
