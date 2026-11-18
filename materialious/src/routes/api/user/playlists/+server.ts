import { error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { getSequelize } from '#lib/server/database';
import { encryptedPlaylist } from '#lib/server/playlists';

export async function GET({ locals }) {
	if (!locals.userId) error(401, 'Unauthorized');
	return Response.json(
		await getSequelize().UserPlaylistTable.findAll({
			where: { UserId: locals.userId },
			include: [
				{ model: getSequelize().UserPlaylistVideoTable, as: 'videos' },
				{ model: getSequelize().UserTable, as: 'owner', attributes: ['username'] }
			],
			order: [
				['createdAt', 'ASC'],
				[{ model: getSequelize().UserPlaylistVideoTable, as: 'videos' }, 'position', 'ASC']
			]
		})
	);
}

export async function POST({ locals, request }) {
	if (!locals.userId) error(401, 'Unauthorized');
	const data = encryptedPlaylist.safeParse(await request.json());
	if (!data.success) error(400, 'Invalid encrypted playlist');
	const playlist = await getSequelize().UserPlaylistTable.create({
		...data.data,
		id: randomUUID(),
		UserId: locals.userId
	});
	return Response.json(playlist, { status: 201 });
}
