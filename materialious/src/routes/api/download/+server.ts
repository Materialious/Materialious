import { createDownload, getDownloadSession } from '@materialious/shared/download';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { isOwnBackend } from '$lib/shared/index';
import { clearDownloadProgress, setDownloadProgress } from '$lib/server/downloadProgress';

const zDownloadSchema = z.object({
	videoId: z.string().length(11),
	downloadId: z.string().optional(),
	type: z.enum(['video', 'audio', 'video+audio', 'merged']).default('merged'),
	quality: z.string().optional(),
	itag: z.coerce.number().int().positive().optional(),
	format: z.string().optional(),
	codec: z.string().optional(),
	language: z.string().optional()
});

function contentDisposition(filename: string): string {
	// `filename` is an ASCII fallback for older clients. `filename*` preserves
	// the original Unicode title without putting non-ByteString characters in a
	// Node response header.
	const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/[;"\\]/g, '_');
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET({ request, url, locals }) {
	if (isOwnBackend()?.requireAuth && !locals.userId) {
		throw error(401);
	}

	const data = zDownloadSchema.safeParse(Object.fromEntries(url.searchParams));

	if (!data.success) {
		throw error(400, data.error.message);
	}

	const { downloadId } = data.data;

	if (downloadId) {
		setDownloadProgress(downloadId, 0);
	}

	let resolved;
	try {
		const session = await getDownloadSession(data.data.videoId);
		const video = await session.getInfo(data.data.videoId);

		resolved = await createDownload({
			media: video,
			selection: data.data,
			abortSignal: request.signal,
			...(downloadId ? { onProgress: (progress) => setDownloadProgress(downloadId, progress) } : {})
		});
	} catch (err) {
		if (downloadId) clearDownloadProgress(downloadId);
		throw error(500, err instanceof Error ? err.message : 'Failed to prepare download');
	}

	const headers = new Headers({
		'Content-Type': resolved.mimeType,
		'Content-Disposition': contentDisposition(resolved.filename),
		'Cache-Control': 'no-store'
	});

	if (resolved.size) {
		headers.set('Content-Length', String(resolved.size));
	}

	// Wrap the stream so that ffmpeg is cleaned up when the client disconnects.
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			reader = resolved.stream.getReader();

			void (async () => {
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) {
							controller.close();
							break;
						}
						controller.enqueue(value);
					}
				} catch (err) {
					controller.error(err);
				} finally {
					await resolved.close?.();
					if (downloadId) clearDownloadProgress(downloadId);
				}
			})();
		},
		cancel() {
			void reader?.cancel();
			void resolved.close?.();
			if (downloadId) clearDownloadProgress(downloadId);
		}
	});

	return new Response(stream, { headers });
}
