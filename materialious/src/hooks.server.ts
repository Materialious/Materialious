import { isOwnBackend } from '$lib/backend';
import { sequelize } from '$lib/backendOnly/database';
import { unsign } from 'cookie-signature';
import { env } from '$env/dynamic/private';
import { User } from '$lib/backendOnly/user';

let sequelizeAuthenticated = false;
export async function handle({ event, resolve }) {
	if (!isOwnBackend()?.internalAuth) {
		return await resolve(event);
	}

	if (!sequelizeAuthenticated) {
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
			event.locals.userBackend = new User(userId);
		}
	}

	return await resolve(event);
}
