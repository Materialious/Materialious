import { error, json } from '@sveltejs/kit';
import { getUser } from '#lib/server/user';
import { verifyTwoFactor } from '#lib/server/twoFactor';
import { isOwnBackend } from '#lib/shared/index';
import z from 'zod';

const schema = z.object({ token: z.string().regex(/^[0-9]{6}$/) });

export async function POST({ locals, request }) {
	if (!isOwnBackend()?.internalAuth || !locals.userId) throw error(401);
	const body = schema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Invalid authentication code');
	const user = await getUser(locals.userId);
	await verifyTwoFactor(user.data, body.data.token, true);
	return json({ verified: true }, { headers: { 'Cache-Control': 'no-store' } });
}
