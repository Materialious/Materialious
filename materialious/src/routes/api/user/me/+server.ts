import { getUser } from '$lib/server/user';
import { error, json } from '@sveltejs/kit';

export async function GET({ locals }) {
	if (!locals.userId) throw error(401);

	const user = await getUser(locals.userId);

	return json({
		username: user.data.username,
		passwordSalt: user.data.passwordSalt,
		decryptionKeySalt: user.data.decryptionKeySalt,
		masterKeyCipher: user.data.masterKeyCipher,
		masterKeyNonce: user.data.masterKeyNonce
	});
}
