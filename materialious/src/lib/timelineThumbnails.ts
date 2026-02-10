import type { StoryBoard } from './api/model';
import { ImageCache } from './images';

export interface TimelineThumbnail {
	url: string;
	time: number;
	width: number;
	height: number;
	index: number;
	localIndex: number;
}

export async function storyboardThumbnails(
	storyboard: StoryBoard,
	imageCache: ImageCache,
	videoLength: number
): Promise<TimelineThumbnail[]> {
	const { count, storyboardCount, width, height, templateUrl } = storyboard;

	// Our ytjs implementation doesn't do this right,
	// so just assume its incorrect and fetch manually.
	// Doesn't actually add any extra overhead.
	const firstSheetUrl = templateUrl.replace('M$M', `M0`);
	const firstSheetImage = await imageCache.load(firstSheetUrl);
	if (!firstSheetImage) {
		return [];
	}

	const storyboardWidth = firstSheetImage.width;
	const storyboardHeight = firstSheetImage.height;

	const cols = Math.floor(storyboardWidth / width);
	const rows = Math.floor(storyboardHeight / height);
	const thumbnails: TimelineThumbnail[] = [];

	const totalThumbnails = storyboardCount * count;
	const videoDurationMs = videoLength * 1000;

	let globalIndex = 0;

	for (let sheetIndex = 0; sheetIndex < storyboardCount; sheetIndex++) {
		const url = templateUrl.replace('M$M', `M${sheetIndex}`);

		// Preload all images.
		imageCache.load(url);

		for (let i = 0; i < count; i++) {
			const localIndex = i % (cols * rows);
			const row = Math.floor(localIndex / cols);

			if (row >= rows) break;

			const time = Math.floor((globalIndex / totalThumbnails) * videoDurationMs);

			thumbnails.push({
				url,
				time,
				width,
				height,
				index: globalIndex,
				localIndex
			});

			globalIndex++;
		}
	}

	return thumbnails;
}

export async function drawTimelineThumbnail(
	ctx: CanvasRenderingContext2D,
	imageCache: ImageCache,
	thumbnails: TimelineThumbnail[],
	time: number
): Promise<void> {
	if (!thumbnails.length) return;

	const timeInMs = time * 1000;

	const closest = thumbnails.reduce((prev, curr) =>
		Math.abs(curr.time - timeInMs) < Math.abs(prev.time - timeInMs) ? curr : prev
	);

	if (!closest.url) return;

	const img = await imageCache.load(closest.url);
	if (!img) {
		return;
	}

	const sheetWidth = img.width;
	const sheetHeight = img.height;

	const cols = Math.floor(sheetWidth / closest.width);
	const rows = Math.floor(sheetHeight / closest.height);
	const thumbnailsPerSheet = cols * rows;

	const indexInSheet = closest.index % thumbnailsPerSheet;
	const thumbX = (indexInSheet % cols) * closest.width;
	const thumbY = Math.floor(indexInSheet / cols) * closest.height;

	ctx.clearRect(0, 0, closest.width, closest.height);
	ctx.drawImage(
		img,
		thumbX,
		thumbY,
		closest.width,
		closest.height,
		0,
		0,
		closest.width,
		closest.height
	);
}
