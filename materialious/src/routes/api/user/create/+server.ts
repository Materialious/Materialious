import { isOwnBackend } from '$lib/shared';
import { createUser } from '$lib/server/user.js';
import { error } from '@sveltejs/kit';
import z from 'zod';

const zUserCreate = z.object({
	username: z.string().min(3).max(32),
	password: z.object({
		hash: z.string().max(255),
		salt: z.string().max(255)
	}),
	subscriptionPasswordSalt: z.string().max(255)
});

export async function POST({ request }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.registrationAllowed) {
		return new Response('', { status: 500 });
	}

	const userToCreate = zUserCreate.safeParse(await request.json());

	if (!userToCreate.success) throw error(400);

	await createUser({
		username: userToCreate.data.username,
		password: {
			hash: userToCreate.data.password.hash,
			salt: userToCreate.data.password.salt
		},
		subscriptionPasswordSalt: userToCreate.data.subscriptionPasswordSalt
	});

	return new Response('');
}
