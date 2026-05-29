import { json } from '@sveltejs/kit';
import { createChallenge, randomInt } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

export async function GET({ locals }) {
	return json(
		await createChallenge({
			hmacSignatureSecret: locals.captchaSignature,
			hmacKeySignatureSecret: locals.captchaKey,
			expiresAt: new Date(Date.now() + 600_000),
			algorithm: 'PBKDF2/SHA-256',
			cost: 5_000,
			counter: randomInt(5_000, 10_000),
			deriveKey
		})
	);
}
