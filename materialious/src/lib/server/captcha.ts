import { error } from '@sveltejs/kit';
import { verifySolution } from 'altcha-lib';
import { getSequelize } from './database';

export async function verifyCaptcha(payload: string, key: string, maxUses: number = -1) {
	const passedCaptcha = await verifySolution(payload, key, true);
	if (!passedCaptcha) {
		throw error(400, 'Unsupported payload');
	}

	let captchaSignature: string | undefined;
	try {
		const decodedCaptcha = JSON.parse(Buffer.from(payload, 'base64').toString());

		captchaSignature = decodedCaptcha.signature;
	} catch {
		// Handle error outside of catch
	}

	if (typeof captchaSignature === 'undefined') {
		throw error(400, 'Unsupported payload');
	}

	if (maxUses !== -1) {
		if (
			(await getSequelize().CaptchaTable.count({ where: { signature: captchaSignature } })) >=
			maxUses
		) {
			throw error(400, 'Unsupported payload');
		}

		await getSequelize().CaptchaTable.create({
			signature: captchaSignature,
			created: new Date()
		});
	}
}
