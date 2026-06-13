import { getUser } from '$lib/server/user';
import { getSequelize } from '$lib/server/database';
import { error, json } from '@sveltejs/kit';
import { isAdminUsername } from '$lib/shared';

export async function GET({ locals }) {
	if (!locals.userId) throw error(401);

	const user = await getUser(locals.userId);
	if (!isAdminUsername(user.data.username)) {
		throw error(403);
	}

	const sequelize = getSequelize();
	const allUsers = await sequelize.UserTable.findAll({
		attributes: ['id', 'username', 'created']
	});

	return json(allUsers.map((u: any) => ({
		id: u.id,
		username: u.username,
		created: u.created
	})));
}
