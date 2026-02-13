import { isOwnBackend } from '$lib/shared';
import { createUser } from '$lib/server/user.js';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { setAuthCookie } from '$lib/server/misc.js';

const zUserCreate = z.object({
	username: z.string().min(3).max(18),
	password: z.object({
		hash: z.string().max(255),
		salt: z.string().max(255)
	}),
	decryptionKeySalt: z.string().max(255),
	masterKey: z.object({
		cipher: z.string().max(255),
		nonce: z.string().max(255)
	})
});

export async function POST({ request, cookies }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.registrationAllowed) {
		throw error(500);
	}

	const userToCreate = zUserCreate.safeParse(await request.json());

	if (!userToCreate.success) throw error(400);

	const createdUser = await createUser({
		username: userToCreate.data.username,
		password: {
			hash: userToCreate.data.password.hash,
			salt: userToCreate.data.password.salt
		},
		decryptionKeySalt: userToCreate.data.decryptionKeySalt,
		masterKey: {
			cipher: userToCreate.data.masterKey.cipher,
			nonce: userToCreate.data.masterKey.nonce
		}
	});

	setAuthCookie(createdUser.id, cookies);

	return new Response('');
}
