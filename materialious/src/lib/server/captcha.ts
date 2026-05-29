import { error } from '@sveltejs/kit';
import { verifySolution } from 'altcha-lib';
import { getSequelize } from './database';
import { isOwnBackend } from '$lib/shared';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import z from 'zod';

const zCaptchaChallenge = z.object({
	codeChallenge: z
		.object({
			image: z.string(),
			audio: z.string().optional(),
			length: z.number().optional()
		})
		.optional(),
	parameters: z.object({
		algorithm: z.string(),
		nonce: z.string(),
		salt: z.string(),
		cost: z.number(),
		keyLength: z.number(),
		keyPrefix: z.string(),
		keySignature: z.string().optional(),
		memoryCost: z.number().optional(),
		parallelism: z.number().optional(),
		expiresAt: z.number().optional(),
		data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
	}),
	signature: z.string()
});

const zCaptchaSolution = z.object({
	counter: z.number(),
	derivedKey: z.string(),
	time: z.number().optional()
});

export const captchaPayload = z.object({
	solution: zCaptchaSolution,
	challenge: zCaptchaChallenge
});

export async function verifyCaptcha(captcha: {
	solution: z.infer<typeof zCaptchaSolution>;
	challenge: z.infer<typeof zCaptchaChallenge>;
	key: string;
	signature: string;
	maxUses?: number;
}) {
	if (isOwnBackend()?.captchaDisabled) return;

	if (!captcha.maxUses) captcha.maxUses = -1;

	const captchaVerified = await verifySolution({
		deriveKey,
		hmacKeySignatureSecret: captcha.key,
		hmacSignatureSecret: captcha.signature,
		solution: captcha.solution,
		challenge: captcha.challenge
	});

	if (!captchaVerified.verified || captchaVerified.expired) {
		throw error(400, 'Unsupported payload');
	}

	if (captcha.maxUses !== -1) {
		if (
			(await getSequelize().CaptchaTable.count({
				where: { signature: captcha.challenge.signature }
			})) >= captcha.maxUses
		) {
			throw error(400, 'Unsupported payload');
		}

		await getSequelize().CaptchaTable.create({
			signature: captcha.challenge.signature,
			created: new Date()
		});
	}
}
