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
