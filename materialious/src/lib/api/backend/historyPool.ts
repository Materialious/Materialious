import type { VideoWatchHistory } from '../model';
import { getWatchHistory } from './history';

const videoIds: string[] = [];
const pendingResolves = new Map<string, (result: VideoWatchHistory | undefined) => void>();

let timeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1000;
const BATCH_SIZE = 100;

async function processBatches(): Promise<void> {
	const batches: string[][] = [];

	while (videoIds.length > 0) {
		batches.push(videoIds.splice(0, BATCH_SIZE));
	}

	const results: VideoWatchHistory[] = [];

	for (const batch of batches) {
		const res: VideoWatchHistory[] = await getWatchHistory({
			videoIds: batch,
			fetchOptions: { priority: 'low' }
		});
		results.push(...res);

		// Resolve pending promises for this batch
		for (const videoId of batch) {
			const match = res.find((item) => item.videoId === videoId);
			const resolve = pendingResolves.get(videoId);
			if (resolve) {
				resolve(match);
				pendingResolves.delete(videoId);
			}
		}
	}
}

export function queueGetWatchHistory(videoId: string): Promise<VideoWatchHistory | undefined> {
	videoIds.push(videoId);

	const promise = new Promise<VideoWatchHistory | undefined>((resolve) => {
		pendingResolves.set(videoId, resolve);
	});

	if (timeout) clearTimeout(timeout);
	timeout = setTimeout(() => {
		processBatches().catch((e) => {
			console.error('Failed to process batches:', e);
		});
	}, DEBOUNCE_MS);

	return promise;
}
