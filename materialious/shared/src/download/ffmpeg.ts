import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
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

export async function mergeStreams(options: MergeStreamsOptions): Promise<MergedStream> {
	const ffmpegPath = (await resolveFFmpegPath()) ?? 'ffmpeg';
	const { videoStream, audioStream, container, durationMs, totalBytes, onProgress, abortSignal } =
		options;
	const tmpDir = await mkdtemp(join(tmpdir(), 'materialious-'));
	const videoPath = join(tmpDir, 'video');
	const audioPath = join(tmpDir, 'audio');
	const abort = new AbortController();
	let child: ChildProcess | undefined;
	let childDone: Promise<void> | undefined;
	let downloads: Promise<unknown>[] = [];
	let cleanupPromise: Promise<void> | undefined;
	let output: PassThrough | undefined;
	const onAbort = () => void cleanup();

	function cleanup(): Promise<void> {
		if (cleanupPromise) return cleanupPromise;
		cleanupPromise = (async () => {
			abortSignal?.removeEventListener('abort', onAbort);
			abort.abort();
			child?.kill('SIGKILL');
			output?.destroy();
			await Promise.allSettled(downloads);
			await childDone;
			await rm(tmpDir, { recursive: true, force: true });
		})();
		return cleanupPromise;
	}

	let downloadedBytes = 0;
	const makeCounter = () =>
		new Transform({
			transform(chunk: Buffer, _encoding, callback) {
				downloadedBytes += chunk.length;
				if (onProgress && totalBytes) onProgress(Math.min(90, (downloadedBytes / totalBytes) * 90));
				callback(null, chunk);
			}
		});

	abortSignal?.addEventListener('abort', onAbort, { once: true });
	try {
		if (abortSignal?.aborted) throw new Error('Download aborted');
		downloads = [
			pipeline(
				Readable.fromWeb(videoStream as unknown as NodeReadableStream),
				makeCounter(),
				createWriteStream(videoPath),
				{ signal: abort.signal }
			),
			pipeline(
				Readable.fromWeb(audioStream as unknown as NodeReadableStream),
				makeCounter(),
				createWriteStream(audioPath),
				{ signal: abort.signal }
			)
		];
		await Promise.all(downloads);
		if (abort.signal.aborted || abortSignal?.aborted) throw new Error('Download aborted');

		child = spawn(
			ffmpegPath,
			[
				'-hide_banner',
				'-loglevel',
				'error',
				'-progress',
				'pipe:2',
				'-i',
				videoPath,
				'-i',
				audioPath,
				'-c:v',
				'copy',
				'-c:a',
				'copy',
				'-fflags',
				'+genpts',
				'-f',
				CONTAINER_FORMAT[container],
				...(container === 'mp4' ? ['-movflags', 'frag_keyframe+empty_moov+default_base_moof'] : []),
				'pipe:1'
			],
			{ stdio: ['ignore', 'pipe', 'pipe'] }
		);
		output = new PassThrough();
		const result = output;
		let diagnostics = '';
		let pending = '';
		child.stderr!.setEncoding('utf8');
		child.stderr!.on('data', (chunk: string) => {
			pending += chunk;
			const lines = pending.split('\n');
			pending = lines.pop() ?? '';
			for (const line of lines) {
				if (line.startsWith('out_time_us=') && durationMs && onProgress) {
					const percent = Math.max(
						0,
						Math.min(100, (Number(line.slice(12)) / (durationMs * 1000)) * 100)
					);
					if (Number.isFinite(percent)) onProgress(totalBytes ? 90 + percent * 0.1 : percent);
				} else if (!line.includes('=')) {
					diagnostics = (diagnostics + line + '\n').slice(-8192);
				}
			}
		});
		child.stdout!.pipe(result, { end: false });
		let spawnError: Error | undefined;
		child.on('error', (err) => {
			spawnError = err;
		});
		childDone = new Promise((resolve) => {
			child!.on('close', (code) => {
				if (!abort.signal.aborted) {
					if (spawnError || code !== 0)
						result.destroy(
							spawnError ?? new Error(`FFmpeg exited with code ${code}: ${diagnostics.trim()}`)
						);
					else {
						onProgress?.(100);
						result.end();
					}
				}
				resolve();
			});
		});
	} catch (err) {
		await cleanup();
		throw err;
	}

	return {
		stream: Readable.toWeb(output) as unknown as ReadableStream<Uint8Array>,
		close: cleanup
	};
}
