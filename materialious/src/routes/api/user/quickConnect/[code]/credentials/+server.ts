import { error, json } from '@sveltejs/kit';
import { isOwnBackend } from '$lib/shared';
import { getQuickConnectCredentials, setQuickConnectCredentials } from '$lib/server/quickConnect';
import z from 'zod';

const zCredentials = z.object({
	cipher: z.string().min(1).max(5000)
});

export async function GET({ params }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	const cipher = await getQuickConnectCredentials(params.code);
	if (!cipher) throw error(404);

	return json({ cipher });
}

export async function POST({ request, params }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	const body = zCredentials.safeParse(await request.json());
	if (!body.success) throw error(400);

	const stored = await setQuickConnectCredentials(params.code, body.data.cipher);
	if (!stored) throw error(409);

	return json({ success: true });
}
