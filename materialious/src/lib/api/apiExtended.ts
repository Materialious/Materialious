import type { ApiExntendedProgressModel } from './model';
import { getVideoProgress } from '.';

const videoIds: string[] = [];
const pendingResolves = new Map<string, (result: ApiExntendedProgressModel | undefined) => void>();

let timeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1000;
const BATCH_SIZE = 100;

async function processBatches(): Promise<void> {
	const batches: string[][] = [];

	while (videoIds.length > 0) {
		batches.push(videoIds.splice(0, BATCH_SIZE));
	}

	const results: ApiExntendedProgressModel[] = [];

	for (const batch of batches) {
		const res: ApiExntendedProgressModel[] = await getVideoProgress(batch.join(','));
		results.push(...res);

		// Resolve pending promises for this batch
		for (const videoId of batch) {
			const match = res.find((item) => item.video_id === videoId);
			const resolve = pendingResolves.get(videoId);
			if (resolve) {
				resolve(match);
				pendingResolves.delete(videoId);
			}
		}
	}
}

export function queueGetWatchProgress(
	videoId: string
): Promise<ApiExntendedProgressModel | undefined> {
	videoIds.push(videoId);

	const promise = new Promise<ApiExntendedProgressModel | undefined>((resolve) => {
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
