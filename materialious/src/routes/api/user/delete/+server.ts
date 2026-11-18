import { authenticateUser, getUser } from '#lib/server/user';
import { isOwnBackend } from '#lib/shared/index';
import { error } from '@sveltejs/kit';
import z from 'zod';

const passwordSchema = z.object({ currentPasswordHash: z.string().min(1).max(255) });

export async function DELETE({ locals, request, cookies }) {
	if (!isOwnBackend()?.internalAuth || !locals.userId) throw error(401);
	const body = passwordSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Current password is required');

	const user = await getUser(locals.userId);
	await authenticateUser(user.data.username, body.data.currentPasswordHash);
	await user.delete();
	cookies.delete('userid', { path: '/api' });

	return new Response(null, { status: 204 });
}
