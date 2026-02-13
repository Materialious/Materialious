import { isOwnBackend } from '$lib/shared';
import { sequelize } from '$lib/server/database';
import { unsign } from 'cookie-signature';
import { env } from '$env/dynamic/private';
import sodium from 'libsodium-wrappers-sumo';

let captchaKey = '';
sodium.ready.then(() => {
	captchaKey = sodium.to_base64(sodium.randombytes_buf(32));
});

let sequelizeAuthenticated = false;
export async function handle({ event, resolve }) {
	event.locals.captchaKey = captchaKey;

	if (!isOwnBackend()?.internalAuth) {
		return await resolve(event);
	}

	if (!sequelizeAuthenticated) {
		await sequelize.sync();
		await sequelize.authenticate();
		sequelizeAuthenticated = true;
	}

	if (!env.COOKIE_SECRET) {
		throw new Error('Cookie secret must be set');
	}

	const signedUserId = event.cookies.get('userid');
	if (signedUserId) {
		const userId = unsign(signedUserId, env.COOKIE_SECRET);
		if (userId) {
			event.locals.userId = userId;
		}
	}

	return await resolve(event);
}
