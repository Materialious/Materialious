import z from 'zod';
import { error } from '@sveltejs/kit';
import { getSequelize } from './database';

// As with watch history, each identifying attribute has its own secretbox
// ciphertext and nonce. Numeric duration/count and ordering remain queryable.
const nonce = z.string().min(1).max(255);
export const encryptedPlaylist = z.object({
	titleCipher: z.string().min(24).max(4096),
	titleNonce: nonce
});

export const encryptedPlaylistVideo = encryptedPlaylist.extend({
	videoIdCipher: z.string().min(24).max(255),
	videoIdNonce: nonce,
	authorCipher: z.string().min(24).max(4096),
	authorNonce: nonce,
	authorIdCipher: z.string().min(24).max(255),
	authorIdNonce: nonce,
	thumbnailCipher: z.string().min(24).max(8192),
	thumbnailNonce: nonce,
	lengthSeconds: z.number().int().nonnegative().max(115200),
	viewCount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
});

export async function ownedPlaylist(userId: string | undefined, id: string) {
	if (!userId) error(401, 'Unauthorized');
	const playlist = await getSequelize().UserPlaylistTable.findOne({
		where: { UserId: userId, id },
		include: [
			{ model: getSequelize().UserPlaylistVideoTable, as: 'videos' },
			{ model: getSequelize().UserTable, as: 'owner', attributes: ['username'] }
		],
		order: [[{ model: getSequelize().UserPlaylistVideoTable, as: 'videos' }, 'position', 'ASC']]
	});
	if (!playlist) error(404, 'Playlist not found');
	return playlist;
}
