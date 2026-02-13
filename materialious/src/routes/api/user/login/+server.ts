import { authenticateUser, User } from '$lib/backendOnly/user';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { env } from '$env/dynamic/private';
import { sign } from 'cookie-signature';

const zUserLogin = z.object({
	username: z.string(),
	passwordHash: z.string()
});

export async function POST({ request, cookies }) {
	const userLogin = zUserLogin.safeParse(await request.json());

	if (!userLogin.success) throw error(401);

	const userModel = await authenticateUser(userLogin.data.username, userLogin.data.passwordHash);

	cookies.set('userid', sign(userModel.id, env.COOKIE_SECRET), {
		httpOnly: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 60 // 60 days
	});

	return new Response();
}
