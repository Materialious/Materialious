import { authenticateUser } from '#lib/server/user';
import { error } from '@sveltejs/kit';
import z from 'zod';
import { verifyTwoFactor } from '#lib/server/twoFactor';
import { isOwnBackend } from '#lib/shared/index';
import { generateAuthToken, setAuthCookie } from '#lib/server/misc';
import { captchaPayload, verifyCaptcha } from '#lib/server/captcha';

const zUserLogin = z.object({
	username: z.string(),
	passwordHash: z.string(),
	captchaPayload: captchaPayload.nullable(),
	twoFactorToken: z
		.string()
		.regex(/^[0-9]{6}$/)
		.optional()
});

export async function POST({ request, cookies, locals }) {
	if (!isOwnBackend()?.internalAuth) {
		throw error(500);
	}

	const userLogin = zUserLogin.safeParse(await request.json().catch(() => null));

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

	if (userModel.data.twoFactorVerified) {
		if (!userLogin.data.twoFactorToken) {
			return Response.json(
				{ error: 'two_factor_required' },
				{ status: 401, headers: { 'Cache-Control': 'no-store' } }
			);
		}
		await verifyTwoFactor(userModel.data, userLogin.data.twoFactorToken);
	}

	setAuthCookie(userModel.id, cookies);

	return Response.json(
		{
			token: generateAuthToken(userModel.id),
			masterKeyCipher: userModel.data.masterKeyCipher,
			masterKeyNonce: userModel.data.masterKeyNonce
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
}
