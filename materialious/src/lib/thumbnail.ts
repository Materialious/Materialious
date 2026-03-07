import type { Image } from './api/model';
import { localDb } from './dexie';
import { getBestThumbnail } from './images';

let isInitial = false;

export async function associateAvatar(channelId: string, avatars: Image[]) {
	if (avatars.length === 0) return;

	await localDb.channelAvatars.put(
		{
			channelId: channelId,
			avatarUrl: getBestThumbnail(avatars),
			updated: new Date()
		},
		{ channelId: channelId }
	);

	if (isInitial) {
		isInitial = true;

		const oneMonthAgo = new Date();
		oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
		localDb.channelAvatars.where('updated').below(oneMonthAgo).delete();
	}
}

export async function avatarFromChannelId(channelId: string): Promise<void | string> {
	const result = await localDb.channelAvatars.get({ channelId });
	if (result) {
		return result.avatarUrl;
	}
}
