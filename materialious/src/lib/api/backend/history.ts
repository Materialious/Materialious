import sodium from 'libsodium-wrappers-sumo';
import { decryptWithMasterKey, encryptWithMasterKey, getRawKey, getSecureHash } from './encryption';
import type { VideoPlay, VideoWatchHistory } from '../model';
import { getBestThumbnail } from '$lib/images';

export async function updateWatchHistoryBackend(videoId: string, progress: number) {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const videoHash = await getSecureHash(videoId, rawKey);

	await fetch(`/api/user/history/${videoHash}`, {
		method: 'POST',
		credentials: 'same-origin',
		body: JSON.stringify({
			watched: new Date(),
			progress
		})
	});
}

async function decryptWatchHistory(
	history: Record<string, string | number>
): Promise<VideoWatchHistory> {
	const author = (await decryptWithMasterKey(
		history.authorNonce as string,
		history.authorCipher as string
	)) as string;
	const title = (await decryptWithMasterKey(
		history.titleNonce as string,
		history.titleCipher as string
	)) as string;
	const thumbnail = (await decryptWithMasterKey(
		history.thumbnailNonce as string,
		history.thumbnailCipher as string
	)) as string;
	const videoId = (await decryptWithMasterKey(
		history.videoIdNonce as string,
		history.videoIdCipher as string
	)) as string;

	return {
		author,
		title,
		thumbnail,
		videoId,
		watched: new Date(history.watched),
		lengthSeconds: history.lengthSeconds as number,
		id: history.id as string,
		progress: history.progress as number,
		type: 'historyVideo'
	};
}

export async function getVideoWatchHistoryBackend(
	videoId: string
): Promise<VideoWatchHistory | undefined> {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const videoHash = await getSecureHash(videoId, rawKey);

	const resp = await fetch(`/api/user/history/${videoHash}`, {
		method: 'GET',
		credentials: 'same-origin'
	});

	if (!resp.ok) return;

	return await decryptWatchHistory(await resp.json());
}

export async function getWatchHistoryBackend(
	options: { page?: number; videoIds?: string[]; fetchOptions?: RequestInit } = {
		page: undefined,
		videoIds: undefined,
		fetchOptions: undefined
	}
): Promise<VideoWatchHistory[]> {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return [];

	const videoHashes: string[] = [];
	if (options.videoIds) {
		for (const videoId of options.videoIds) {
			videoHashes.push(await getSecureHash(videoId, rawKey));
		}
	}

	const params = new URLSearchParams();

	if (options.page) {
		params.set('page', options.page.toString());
	}

	if (options.videoIds && options.videoIds.length > 0) {
		params.set('videoHashes', videoHashes.join(','));
	}

	const resp = await fetch(`/api/user/history?${params.toString()}`, options.fetchOptions);
	if (!resp.ok) return [];

	const rawHistory = await resp.json();

	const history: VideoWatchHistory[] = [];

	for (const item of rawHistory) {
		history.push(await decryptWatchHistory(item));
	}

	return history;
}

export async function deleteWatchHistoryBackend() {
	await fetch('/api/user/history', { method: 'DELETE' });
}

export async function deleteWatchHistoryItemBackend(videoId: string) {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const videoHash = await getSecureHash(videoId, rawKey);

	await fetch(`/api/user/history/${videoHash}`, { method: 'DELETE' });
}

export async function saveWatchHistoryBackend(video: VideoPlay, progress: number = 0) {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const videoHash = await getSecureHash(video.videoId, rawKey);

	const title = await encryptWithMasterKey(video.title);
	const author = await encryptWithMasterKey(video.author);
	const thumbnail = await encryptWithMasterKey(getBestThumbnail(video.videoThumbnails));
	const videoId = await encryptWithMasterKey(video.videoId);

	await fetch('/api/user/history', {
		method: 'POST',
		credentials: 'same-origin',
		body: JSON.stringify({
			id: videoHash,
			watched: new Date(),
			progress: progress,
			title: {
				cipher: title?.cipher,
				nonce: title?.nonce
			},
			author: {
				cipher: author?.cipher,
				nonce: author?.nonce
			},
			thumbnail: {
				cipher: thumbnail?.cipher,
				nonce: thumbnail?.nonce
			},
			videoId: {
				cipher: videoId?.cipher,
				nonce: videoId?.nonce
			},
			lengthSeconds: video.lengthSeconds
		})
	});
}
