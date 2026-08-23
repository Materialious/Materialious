import { createWriteStream, existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import ffmpeg from 'fluent-ffmpeg';
import type { MergeContainer } from './types.js';

const CONTAINER_FORMAT: Record<MergeContainer, string> = {
	mp4: 'mp4',
	webm: 'webm',
	mkv: 'matroska'
};

let cachedFFmpegPath: string | undefined;

export async function resolveFFmpegPath(): Promise<string | undefined> {
	if (cachedFFmpegPath) return cachedFFmpegPath;

	const envPath = process.env.FFMPEG_PATH;
	if (envPath && existsSync(envPath)) {
		cachedFFmpegPath = envPath;
		return cachedFFmpegPath;
	}

	try {
		const mod = (await import('ffmpeg-static')) as unknown;
		const staticPath = (mod as { default?: string }).default ?? (mod as string);
		if (typeof staticPath === 'string' && staticPath && existsSync(staticPath)) {
			cachedFFmpegPath = staticPath;
			return cachedFFmpegPath;
		}
	} catch {
		// ffmpeg-static is not installed, fall back to system `ffmpeg`.
	}

	return undefined;
}

function getCodecs(mimeType?: string): string[] {
	if (!mimeType) return [];
	const codecsMatch = mimeType.match(/codecs="([^"]+)"/);
	return codecsMatch ? codecsMatch[1].split(',').map((codec) => codec.trim()) : [];
}

export function inferMergeContainer(
	videoFormat: { mimeType?: string },
	audioFormat: { mimeType?: string },
	preferredContainer?: string
): MergeContainer {
	const videoCodec = getCodecs(videoFormat.mimeType)[0] ?? '';
	const audioCodec = getCodecs(audioFormat.mimeType)[0] ?? '';

	const fitsMp4 = videoCodec.startsWith('avc') && audioCodec.startsWith('mp4a');

	const webmVideo =
		videoCodec.startsWith('vp9') ||
		videoCodec.startsWith('vp09') ||
		videoCodec.startsWith('vp8') ||
		videoCodec.startsWith('av01');
	const webmAudio = audioCodec.startsWith('opus') || audioCodec.startsWith('vorbis');

	// Only honour the requested container when both tracks genuinely fit it;
	// muxing anything else produces broken files (e.g. green screens).
	if (preferredContainer === 'mp4' && fitsMp4) return 'mp4';
	if (preferredContainer === 'webm' && webmVideo && webmAudio) return 'webm';
	if (preferredContainer === 'mkv') return 'mkv';

	if (fitsMp4) return 'mp4';
	if (webmVideo && webmAudio) return 'webm';
	return 'mkv';
}

export type MergeStreamsOptions = {
	videoStream: ReadableStream<Uint8Array>;
	audioStream: ReadableStream<Uint8Array>;
	container: MergeContainer;
	durationMs?: number;
	totalBytes?: number;
	onProgress?: (progress: number) => void;
	abortSignal?: AbortSignal;
};

export type MergedStream = {
	stream: ReadableStream<Uint8Array>;
	close: () => Promise<void>;
};

function parseTimemark(timemark: string): number | undefined {
	const parts = timemark.split(':').map(Number);
	if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
		return undefined;
	}
	return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export async function mergeStreams(options: MergeStreamsOptions): Promise<MergedStream> {
	const ffmpegPath = await resolveFFmpegPath();
	if (ffmpegPath) {
		ffmpeg.setFfmpegPath(ffmpegPath);
	}

	const { videoStream, audioStream, container, durationMs, totalBytes, onProgress, abortSignal } =
		options;

	// fluent-ffmpeg only supports a single piped stream input, so both tracks are
	// written to temporary files first and then muxed from disk.
	const tmpDir = await mkdtemp(join(tmpdir(), 'materialious-'));
	const videoPath = join(tmpDir, `video.${container}`);
	const audioPath = join(tmpDir, `audio.${container}`);

	let downloadedBytes = 0;

	const makeCounter = () =>
		new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				downloadedBytes += chunk.length;
				if (onProgress && totalBytes) {
					onProgress(Math.min(99, (downloadedBytes / totalBytes) * 100));
				}
				callback(null, chunk);
			}
		});

	abortSignal?.addEventListener('abort', () => void cleanup(), { once: true });

	let cleaned = false;
	let command: ReturnType<typeof ffmpeg> | undefined;
	let output: PassThrough | undefined;
	const activeStreams = [videoStream, audioStream];

	async function cleanup() {
		if (cleaned) return;
		cleaned = true;
		command?.kill('SIGKILL');
		output?.destroy();
		for (const stream of activeStreams) {
			stream.cancel().catch(() => undefined);
		}
		try {
			await rm(tmpDir, { recursive: true, force: true });
		} catch {
			// Best-effort cleanup; ignore failures.
		}
	}

	try {
		await Promise.all([
			pipeline(
				Readable.fromWeb(videoStream as unknown as NodeReadableStream),
				makeCounter(),
				createWriteStream(videoPath)
			),
			pipeline(
				Readable.fromWeb(audioStream as unknown as NodeReadableStream),
				makeCounter(),
				createWriteStream(audioPath)
			)
		]);

		if (abortSignal?.aborted) {
			throw new Error('Download aborted');
		}

		command = ffmpeg();
		command.input(videoPath);
		command.input(audioPath);

		command.outputOptions([
			'-c:v copy',
			'-c:a copy',
			'-fflags +genpts',
			'-f',
			CONTAINER_FORMAT[container],
			...(container === 'mp4' ? ['-movflags', 'frag_keyframe+empty_moov+default_base_moof'] : [])
		]);

		output = new PassThrough();

		command.on('error', (err) => {
			output?.destroy(err);
		});

		if (onProgress) {
			command.on('progress', (progress) => {
				let percent: number = typeof progress.percent === 'number' ? progress.percent : NaN;
				if (Number.isNaN(percent) && durationMs) {
					const seconds = parseTimemark(progress.timemark);
					if (seconds !== undefined) {
						percent = ((seconds * 1000) / durationMs) * 100;
					}
				}
				if (Number.isFinite(percent)) {
					const value = totalBytes
						? 90 + Math.max(0, Math.min(100, percent)) * 0.1
						: Math.max(0, Math.min(100, percent));
					onProgress(value);
				}
			});
		}

		command.pipe(output, { end: true });
	} catch (err) {
		await cleanup();
		throw err;
	}

	return {
		stream: Readable.toWeb(output) as unknown as ReadableStream<Uint8Array>,
		close: cleanup
	};
}
