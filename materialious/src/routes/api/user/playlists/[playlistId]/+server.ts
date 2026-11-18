import { error } from '@sveltejs/kit';
import { getSequelize } from '#lib/server/database';
import { ownedPlaylist } from '#lib/server/playlists';

export async function GET({ locals, params }) {
	return Response.json(await ownedPlaylist(locals.userId, params.playlistId));
}

export async function DELETE({ locals, params }) {
	if (!locals.userId) error(401, 'Unauthorized');
	await getSequelize().UserPlaylistTable.destroy({
		where: { UserId: locals.userId, id: params.playlistId }
	});
	return new Response(null, { status: 204 });
}
