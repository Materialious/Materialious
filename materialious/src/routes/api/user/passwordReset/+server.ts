import { getUser } from '$lib/server/user';
import { error } from '@sveltejs/kit';
import z from 'zod';

const zUserPasswordReset = z.object({
	password: z.object({
		hash: z.string().max(255),
		salt: z.string().max(255)
	}),
	decryptionKeySalt: z.string().max(255)
});

export async function POST({ request, locals }) {
	const data = zUserPasswordReset.safeParse(await request.json());
	if (data.error) throw error(400, data.error.message);

	const user = await getUser(locals.userId);

	await user.resetPassword(data.data.password, data.data.decryptionKeySalt);

	return new Response('', { status: 200 });
}
