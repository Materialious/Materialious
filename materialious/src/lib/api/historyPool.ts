import type { VideoWatchHistory } from './model';
import { getWatchHistory } from './index';

type HistoryResolve = (result: VideoWatchHistory | undefined) => void;
const pendingResolves = new Map<string, HistoryResolve[]>();

let timeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 1000;
const BATCH_SIZE = 100;

async function processBatches(): Promise<void> {
	// Keep new requests separate from callers waiting on an in-flight lookup.
	const pending = [...pendingResolves.entries()];
	pendingResolves.clear();

	for (let start = 0; start < pending.length; start += BATCH_SIZE) {
		const batch = pending.slice(start, start + BATCH_SIZE);
		let results: VideoWatchHistory[] = [];
		try {
			results = await getWatchHistory({
				videoIds: batch.map(([videoId]) => videoId),
				fetchOptions: { priority: 'high' }
			});
		} catch (error) {
			console.error('Failed to process history batch:', error);
		}

		for (const [videoId, resolves] of batch) {
			const match = results.find((item) => item.videoId === videoId);
			for (const resolve of resolves) resolve(match);
		}
	}
}

export function queueGetWatchHistory(videoId: string): Promise<VideoWatchHistory | undefined> {
	const promise = new Promise<VideoWatchHistory | undefined>((resolve) => {
		const resolves = pendingResolves.get(videoId) ?? [];
		resolves.push(resolve);
		pendingResolves.set(videoId, resolves);
	});

	if (timeout) clearTimeout(timeout);
	timeout = setTimeout(() => {
		timeout = null;
		void processBatches();
	}, DEBOUNCE_MS);

	return promise;
}
