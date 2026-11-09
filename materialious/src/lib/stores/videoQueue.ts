import { writable, type Writable } from 'svelte/store';

export interface QueuedVideo {
	videoId: string;
	title: string;
	author: string;
	thumbnail?: string;
	viewCountText?: string;
}

export const videoQueueStore: Writable<QueuedVideo[]> = writable([]);

export function addVideoToQueue(video: QueuedVideo): void {
	videoQueueStore.update((queue) =>
		queue.some((queued) => queued.videoId === video.videoId) ? queue : [...queue, video]
	);
}

export function removeVideoFromQueue(videoId: string): void {
	videoQueueStore.update((queue) => queue.filter((video) => video.videoId !== videoId));
}

export function takeNextQueuedVideo(): QueuedVideo | undefined {
	let next: QueuedVideo | undefined;
	videoQueueStore.update((queue) => {
		[next, ...queue] = queue;
		return queue;
	});
	return next;
}
