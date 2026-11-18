import { error } from '@sveltejs/kit';
import { literal } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { getSequelize } from '#lib/server/database';
import { encryptedPlaylistVideo } from '#lib/server/playlists';

export async function POST({ locals, params, request }) {
	if (!locals.userId) error(401, 'Unauthorized');
	const data = encryptedPlaylistVideo.safeParse(await request.json());
	if (!data.success) error(400, 'Invalid encrypted video');
	const { sequelize, UserPlaylistTable, UserPlaylistVideoTable } = getSequelize();
	const video = await sequelize.transaction(async (transaction) => {
		const where = { UserId: locals.userId, id: params.playlistId };
		// Updating the parent first serializes append operations on this playlist.
		const [updated] = await UserPlaylistTable.update(
			{ revision: literal('revision + 1'), updatedAt: new Date() },
			{
				where,
				transaction
			}
		);
		if (!updated) error(404, 'Playlist not found');
		const last = await UserPlaylistVideoTable.max('position', {
			where: { playlistId: params.playlistId },
			transaction
		});
		return UserPlaylistVideoTable.create(
			{
				...data.data,
				id: randomUUID(),
				playlistId: params.playlistId,
				position: typeof last === 'number' ? last + 1 : 0
			},
			{ transaction }
		);
	});
	return Response.json(video, { status: 201 });
}
