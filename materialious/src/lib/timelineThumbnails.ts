import type { StoryBoard } from './api/model';
import { ImageCache } from './images';
import { parseText } from 'media-captions';
import { findElementForTime } from './misc';

export interface TimelineThumbnail {
	url: string;
	startTime: number;
	endTime: number;
	width: number;
	height: number;
	index: number;
	yCoord: number;
	xCoord: number;
}

// Modified implementation from Freetube
// https://github.com/FreeTubeApp/FreeTube/blob/20a44152fb1465cc01f496f1e22abd6a9a4b8390/src/renderer/helpers/utils.js#L107
export function generateThumbnailWebVTT(
	storyboard: StoryBoard & { columns: number; rows: number },
	videoLengthSeconds: number
) {
	let vttString = 'WEBVTT\n\n';
	// Amount of thumbnails per sheet
	const numberOfThumbnailsPerSheet = storyboard.columns * storyboard.rows;
	// Amount of sheets
	const numberOfSheets = storyboard.count;
	let intervalInSeconds;
	if (storyboard.interval > 0) {
		intervalInSeconds = storyboard.interval / 1000;
	} else {
		intervalInSeconds = videoLengthSeconds / (numberOfSheets * numberOfThumbnailsPerSheet);
	}
	let startHours = 0;
	let startMinutes = 0;
	let startSeconds = 0;
	let endHours = 0;
	let endMinutes = 0;
	let endSeconds = intervalInSeconds;
	for (let i = 0; i < numberOfSheets; i++) {
		const currentUrl = storyboard.templateUrl.replace('$M.jpg', `${i}.jpg`);
		let xCoord = 0;
		let yCoord = 0;
		for (let j = 0; j < numberOfThumbnailsPerSheet; j++) {
			// add the timestamp information
			const paddedStartHours = startHours.toString().padStart(2, '0');
			const paddedStartMinutes = startMinutes.toString().padStart(2, '0');
			const paddedStartSeconds = startSeconds.toFixed(3).padStart(6, '0');
			const paddedEndHours = endHours.toString().padStart(2, '0');
			const paddedEndMinutes = endMinutes.toString().padStart(2, '0');
			const paddedEndSeconds = endSeconds.toFixed(3).padStart(6, '0');
			vttString += `${paddedStartHours}:${paddedStartMinutes}:${paddedStartSeconds} --> ${paddedEndHours}:${paddedEndMinutes}:${paddedEndSeconds}\n`;
			// add the current image url as well as the x, y, width, height information
			vttString += `${currentUrl}#xywh=${xCoord},${yCoord},${storyboard.width},${storyboard.height}\n\n`;
			// update the variables
			startHours = endHours;
			startMinutes = endMinutes;
			startSeconds = endSeconds;
			endSeconds += intervalInSeconds;
			if (endSeconds >= 60) {
				endSeconds -= 60;
				endMinutes += 1;
			}
			if (endMinutes >= 60) {
				endMinutes -= 60;
				endHours += 1;
			}
			// x coordinate can only be smaller than the width of one subimage * the number of subimages per row
			xCoord = (xCoord + storyboard.width) % (storyboard.width * storyboard.columns);
			// only if the x coordinate is , so in a new row, we have to update the y coordinate
			if (xCoord === 0) {
				yCoord += storyboard.height;
			}
		}
	}
	return vttString;
}

export async function storyboardThumbnails(WebVTT: string): Promise<TimelineThumbnail[]> {
	const thumbnails: TimelineThumbnail[] = [];

	const thumbnailsSheets = await parseText(WebVTT, {
		strict: true,
		type: 'vtt'
	});

	let index = 0;
	thumbnailsSheets.cues.forEach((cue) => {
		const urlParts = cue.text.split('#xywh=');
		const xywh = urlParts[1];
		const xywhValues = xywh.split(',');

		if (xywhValues.length !== 4) {
			return [];
		}

		const [xCoord, yCoord, thumbWidth, thumbHeight] = xywhValues.map(Number);

		thumbnails.push({
			url: cue.text,
			startTime: cue.startTime,
			endTime: cue.endTime,
			width: thumbWidth,
			height: thumbHeight,
			index,
			xCoord,
			yCoord
		});

		index++;
	});

	return thumbnails;
}

export async function drawTimelineThumbnail(
	ctx: CanvasRenderingContext2D,
	imageCache: ImageCache,
	thumbnails: TimelineThumbnail[],
	currentTime: number
): Promise<void> {
	if (!thumbnails.length) return;

	const thumbnail = findElementForTime(
		thumbnails,
		currentTime,
		(thumbnail: TimelineThumbnail) => thumbnail.startTime,
		(thumbnail: TimelineThumbnail) => thumbnail.endTime
	);

	if (!thumbnail) return;

	const img = await imageCache.load(thumbnail.url);
	if (!img) {
		return;
	}

	const thumbWidth = thumbnail.width;
	const thumbHeight = thumbnail.height;

	ctx.clearRect(0, 0, thumbWidth, thumbHeight);
	ctx.drawImage(
		img,
		thumbnail.xCoord,
		thumbnail.yCoord,
		thumbWidth,
		thumbHeight,
		0,
		0,
		thumbWidth,
		thumbHeight
	);
}
