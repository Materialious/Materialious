import { error, json } from '@sveltejs/kit';
import { isOwnBackend } from '$lib/shared';
import { registerQuickConnectReceiver } from '$lib/server/quickConnect';
import { captchaPayload, verifyCaptcha } from '$lib/server/captcha';
import z from 'zod';

const zReceiver = z.object({
	publicKey: z.string().min(40).max(64),
	captchaPayload: captchaPayload.nullable()
});

export async function POST({ request, locals, params }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	const body = zReceiver.safeParse(await request.json());
	if (!body.success) throw error(400);

	await verifyCaptcha(
		body.data.captchaPayload && {
			solution: body.data.captchaPayload.solution,
			challenge: body.data.captchaPayload.challenge,
			key: locals.captchaKey,
			signature: locals.captchaSignature
		}
	);

	const result = await registerQuickConnectReceiver(params.code, body.data.publicKey);
	if (result === 'conflict') throw error(409);
	if (result !== 'ok') throw error(404);

	return json({ success: true });
}
