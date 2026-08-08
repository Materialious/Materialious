import { getDownloadSession, SabrStream } from '@materialious/shared/download';
import { error, json } from '@sveltejs/kit';
import z from 'zod';
import { isOwnBackend } from '$lib/shared/index';

const zFormatsSchema = z.object({
	videoId: z.string().length(11)
});

export async function POST({ request, locals }) {
	if (isOwnBackend()?.requireAuth && !locals.userId) {
		throw error(401);
	}

	const data = zFormatsSchema.safeParse(await request.json());

	if (!data.success) {
		throw error(400, data.error.message);
	}

	try {
		const session = await getDownloadSession(data.data.videoId);
		const video = await session.getInfo(data.data.videoId);
		const sabrStream = new SabrStream(video);

		return json({
			title: sabrStream.getTitle(),
			formats: sabrStream.getFormats().filter((format) => !format.hasText)
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to fetch video formats');
	}
}
