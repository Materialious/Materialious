import { error, json } from '@sveltejs/kit';
import { isOwnBackend } from '$lib/shared';
import { registerQuickConnectReceiver } from '$lib/server/quickConnect';
import z from 'zod';

const zReceiver = z.object({
	publicKey: z.string().min(40).max(64)
});

export async function POST({ request, params }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	const body = zReceiver.safeParse(await request.json());
	if (!body.success) throw error(400);

	const result = await registerQuickConnectReceiver(params.code, body.data.publicKey);
	if (result === 'conflict') throw error(409);
	if (result !== 'ok') throw error(404);

	return json({ success: true });
}
