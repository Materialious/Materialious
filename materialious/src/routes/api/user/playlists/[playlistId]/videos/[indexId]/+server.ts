import { getSequelize } from '#lib/server/database';
import { ownedPlaylist } from '#lib/server/playlists';

export async function DELETE({ locals, params }) {
	await ownedPlaylist(locals.userId, params.playlistId);
	await getSequelize().UserPlaylistVideoTable.destroy({
		where: { playlistId: params.playlistId, id: params.indexId }
	});
	return new Response(null, { status: 204 });
}
