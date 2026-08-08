import { mintPoTokenInJSDOM } from '@materialious/shared/jsdom';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { isOwnBackend } from '$lib/shared/index';

const zPoTokenGenSchema = z.object({
	requestKey: z.string(),
	visitorData: z.string()
});

export async function POST({ request, locals }) {
	if (isOwnBackend()?.requireAuth && !locals.userId) {
		throw error(401);
	}

	const data = zPoTokenGenSchema.safeParse(await request.json());

	if (!data.success) {
		throw error(400, data.error.message);
	}

	const { requestKey, visitorData } = data.data;

	try {
		return new Response(await mintPoTokenInJSDOM(requestKey, visitorData), {
			status: 200
		});
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Failed to generate PO token');
	}
}
