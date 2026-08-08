import { createDownload, getDownloadSession } from '@materialious/shared/download';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { isOwnBackend } from '$lib/shared/index';

const zDownloadSchema = z.object({
	videoId: z.string().length(11),
	type: z.enum(['video', 'audio', 'video+audio', 'merged']).default('merged'),
	quality: z.string().optional(),
	format: z.string().optional(),
	codec: z.string().optional()
});

export async function GET({ request, url, locals }) {
	if (isOwnBackend()?.requireAuth && !locals.userId) {
		throw error(401);
	}

	const data = zDownloadSchema.safeParse(Object.fromEntries(url.searchParams));

	if (!data.success) {
		throw error(400, data.error.message);
	}

	let resolved;
	try {
		const session = await getDownloadSession(data.data.videoId);
		const video = await session.getInfo(data.data.videoId);

		resolved = await createDownload({
			media: video,
			selection: data.data,
			abortSignal: request.signal
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to prepare download');
	}

	const headers = new Headers({
		'Content-Type': resolved.mimeType,
		'Content-Disposition': `attachment; filename="${resolved.filename}"`,
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
				}
			})();
		},
		cancel() {
			void reader?.cancel();
			void resolved.close?.();
		}
	});

	return new Response(stream, { headers });
}
