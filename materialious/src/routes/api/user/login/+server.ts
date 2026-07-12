import { authenticateUser } from '$lib/server/user';
import { error, json } from '@sveltejs/kit';
import z from 'zod';
import { isOwnBackend } from '$lib/shared';
import { setAuthCookie } from '$lib/server/misc';
import { captchaPayload, verifyCaptcha } from '$lib/server/captcha';

const zUserLogin = z.object({
	username: z.string(),
	passwordHash: z.string(),
	captchaPayload: captchaPayload.nullable()
});

export async function POST({ request, cookies, locals }) {
	if (!isOwnBackend()?.internalAuth) {
		throw error(500);
	}

  const userLogin = zUserLogin.safeParse(await request.json());

  console.log(userLogin.error);

	if (!userLogin.success) throw error(401);

	await verifyCaptcha(
		userLogin.data.captchaPayload && {
			solution: userLogin.data.captchaPayload.solution,
			challenge: userLogin.data.captchaPayload.challenge,
			key: locals.captchaKey,
			signature: locals.captchaSignature
		}
	);

	const userModel = await authenticateUser(userLogin.data.username, userLogin.data.passwordHash);

	setAuthCookie(userModel.id, cookies);

	return json({
		masterKeyCipher: userModel.data.masterKeyCipher,
		masterKeyNonce: userModel.data.masterKeyNonce
	});
}
