import { isOwnBackend } from '$lib/backend';
import { sequelize } from '$lib/backendOnly/database';

let sequelizeAuthenticated = false;
export async function handle({ event, resolve }) {
	const resolved = await resolve(event);

	if (!isOwnBackend()?.internalAuth) {
		return resolved;
	}

	if (!sequelizeAuthenticated) {
		await sequelize.authenticate();
		sequelizeAuthenticated = true;
	}

	return resolved;
}
