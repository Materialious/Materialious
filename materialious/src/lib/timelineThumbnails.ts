import { get } from 'svelte/store';
import type { VideoPlay } from './api/model';
import { ImageCache } from './images';
import { instanceStore } from './store';
import { parseText } from 'media-captions';

export interface TimelineThumbnail {
	url: string;
	time: number;
	width: number;
	height: number;
	index: number;
}

export async function storyboardThumbnails(video: VideoPlay): Promise<TimelineThumbnail[]> {
	if (!video.storyboards || video.storyboards.length < 2) return [];

	const thumbnails: TimelineThumbnail[] = [];

	if (video.fallbackPatch === 'youtubejs') {
		const { count, storyboardCount, width, height, templateUrl } = video.storyboards[2];

		const totalThumbnails = storyboardCount * count;
		const videoDurationMs = video.lengthSeconds * 1000;
		const timeInterval = videoDurationMs / totalThumbnails;

		for (let sheetIndex = 0; sheetIndex < storyboardCount; sheetIndex++) {
			const url = templateUrl.replace('M$M', `M${sheetIndex}`);

			const time = Math.floor(sheetIndex * count * timeInterval);
			thumbnails.push({
				url,
				time,
				width,
				height,
				index: sheetIndex * count
			});
		}
	} else {
		const WebVTTResp = await fetch(`${get(instanceStore)}${video.storyboards[2].url}`);
		if (!WebVTTResp.ok) return [];

		const thumbnailsSheets = await parseText(await WebVTTResp.text(), {
			strict: true,
			type: 'vtt'
		});

		const processedUrls = new Set<string>();

		let index = 0;

		thumbnailsSheets.cues.forEach((cue) => {
			const urlParts = cue.text.split('#');
			const cleanedUrl = urlParts[0];

			if (!processedUrls.has(cleanedUrl)) {
				const xywh = urlParts[1];
				const xywhValues = xywh.split(',');

				if (xywhValues.length !== 4) {
					return [];
				}

				const [, , thumbWidth, thumbHeight] = xywhValues.map(Number);

				processedUrls.add(cleanedUrl);

				thumbnails.push({
					url: cleanedUrl,
					time: cue.startTime * 1000,
					width: thumbWidth,
					height: thumbHeight,
					index
				});

				index++;
			}
		});
	}

	return thumbnails;
}

export async function drawTimelineThumbnail(
	ctx: CanvasRenderingContext2D,
	imageCache: ImageCache,
	thumbnails: TimelineThumbnail[],
	video: VideoPlay,
	currentTime: number
): Promise<void> {
	if (!thumbnails.length) return;

	const timeInMs = currentTime * 1000;

	const closest = thumbnails.reduce((prev, curr) => {
		return Math.abs(curr.time - timeInMs) < Math.abs(prev.time - timeInMs) ? curr : prev;
	});

	const nextThumbnail = thumbnails.find((thumb) => thumb.time > closest.time);
	const spriteSheetEndTime = nextThumbnail ? nextThumbnail.time : video.lengthSeconds * 1000;

	const img = await imageCache.load(closest.url);
	if (!img) {
		return;
	}

	const sheetWidth = img.width;
	const sheetHeight = img.height;

	const thumbWidth = closest.width;
	const thumbHeight = closest.height;

	const cols = Math.floor(sheetWidth / thumbWidth);
	const rows = Math.floor(sheetHeight / thumbHeight);

	const thumbnailsPerSheet = cols * rows;

	const elapsedTime = timeInMs - closest.time;
	const totalDuration = spriteSheetEndTime - closest.time;
	const elapsedPercentage = Math.min(Math.max(elapsedTime / totalDuration, 0), 1);

	const indexInSheet = Math.floor(elapsedPercentage * thumbnailsPerSheet);

	const thumbX = (indexInSheet % cols) * thumbWidth;
	const thumbY = Math.floor(indexInSheet / cols) * thumbHeight;

	ctx.clearRect(0, 0, thumbWidth, thumbHeight);
	ctx.drawImage(img, thumbX, thumbY, thumbWidth, thumbHeight, 0, 0, thumbWidth, thumbHeight);
}
