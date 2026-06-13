import { getUser } from '$lib/server/user';
import { getSequelize } from '$lib/server/database';
import { error } from '@sveltejs/kit';
import { isAdminUsername } from '$lib/shared';

export async function DELETE({ locals, params }) {
	if (!locals.userId) throw error(401);

	const user = await getUser(locals.userId);
	if (!isAdminUsername(user.data.username)) {
		throw error(403);
	}

	const sequelize = getSequelize();
	const targetUser = await sequelize.UserTable.findOne({
		where: { id: params.userId }
	});

	if (!targetUser) {
		throw error(404);
	}

	await sequelize.ChannelSubscriptionTable.destroy({ where: { UserId: params.userId } });
	await sequelize.UserKeyValueTable.destroy({ where: { UserId: params.userId } });
	await sequelize.UserHistoryTable.destroy({ where: { UserId: params.userId } });
	await targetUser.destroy();

	return new Response();
}
