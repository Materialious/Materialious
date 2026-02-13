import { json } from '@sveltejs/kit';
import { createChallenge } from 'altcha-lib';

export async function GET({ locals }) {
	const currentDate = new Date();

	return json(
		await createChallenge({
			hmacKey: locals.captchaKey,
			expires: new Date(currentDate.getTime() + 1 * 60 * 60 * 1000)
		})
	);
}
