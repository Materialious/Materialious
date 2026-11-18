import { error, json } from '@sveltejs/kit';
import { authenticateUser, getUser } from '#lib/server/user';
import { twoFactorStatus, startTwoFactor, removeTwoFactor } from '#lib/server/twoFactor';
import { isOwnBackend } from '#lib/shared/index';
import z from 'zod';

const passwordSchema = z.object({ currentPasswordHash: z.string().min(1).max(255) });
const disableSchema = passwordSchema.extend({ twoFactorToken: z.string().regex(/^[0-9]{6}$/) });
const headers = { 'Cache-Control': 'no-store' };

async function requireUser(userId: string) {
	if (!isOwnBackend()?.internalAuth || !userId) throw error(401);
	return getUser(userId);
}

export async function GET({ locals }) {
	const user = await requireUser(locals.userId);
	return json(twoFactorStatus(user.data), { headers });
}

async function requirePassword(userId: string, request: Request) {
	const user = await requireUser(userId);
	const body = passwordSchema.safeParse(await request.json().catch(() => null));
	if (!body.success) throw error(400, 'Current password is required');
	return authenticateUser(user.data.username, body.data.currentPasswordHash);
}

export async function POST({ locals, request }) {
	const user = await requirePassword(locals.userId, request);
	return json(await startTwoFactor(user.data), { headers });
}

export async function DELETE({ locals, request }) {
	let user = await requireUser(locals.userId);
	let token: string | undefined;
	if (user.data.twoFactorVerified) {
		const body = disableSchema.safeParse(await request.json().catch(() => null));
		if (!body.success) throw error(400, 'Current password and authentication code are required');
		user = await authenticateUser(user.data.username, body.data.currentPasswordHash);
		token = body.data.twoFactorToken;
	}
	await removeTwoFactor(user.data, token);
	return new Response(null, { status: 204, headers });
}
