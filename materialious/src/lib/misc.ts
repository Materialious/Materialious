import { pushState } from '$app/navigation';
import { page } from '$app/stores';
import humanNumber from 'human-number';
import type { PeerOptions } from 'peerjs';
import { get } from 'svelte/store';
import type { Image } from './Api/model';

export function truncate(value: string, maxLength: number = 50): string {
	return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}

export function numberWithCommas(number: number) {
	if (typeof number === 'undefined') return;
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function cleanNumber(number: number): string {
	return humanNumber(number, (number: number) =>
		Number.parseFloat(number.toString()).toFixed(1)
	).replace('.0', '');
}

export function videoLength(lengthSeconds: number): string {
	const hours = Math.floor(lengthSeconds / 3600);
	let minutes: number | string = Math.floor((lengthSeconds % 3600) / 60);
	let seconds: number | string = lengthSeconds % 60;

	if (minutes < 10) {
		minutes = `0${minutes}`;
	}

	if (seconds < 10) {
		seconds = `0${seconds}`;
	}

	if (hours !== 0) {
		return `${hours}:${minutes}:${seconds}`;
	} else {
		return `${minutes}:${seconds}`;
	}
}

export interface PhasedDescription {
	description: string;
	timestamps: { title: string; time: number; timePretty: string }[];
}

export function phaseDescription(content: string): PhasedDescription {
	const timestamps: { title: string; time: number; timePretty: string }[] = [];
	const lines = content.split('\n');

	const urlRegex = /<a href="([^"]+)"/;
	const timestampRegex =
		/<a href="([^"]+)" data-onclick="jump_to_time" data-jump-time="(\d+)">(\d+:\d+(?::\d+)?)<\/a>\s*(.+)/;

	let filteredLines: string[] = [];
	lines.forEach((line) => {
		const urlMatch = urlRegex.exec(line);
		const timestampMatch = timestampRegex.exec(line);

		if (urlMatch !== null && timestampMatch === null) {
			// If line contains a URL but not a timestamp, modify the URL
			const modifiedLine = line.replace(
				/<a href="([^"]+)"/,
				'<a href="$1" target="_blank" rel="noopener noreferrer" class="link"'
			);
			filteredLines.push(modifiedLine);
		} else if (timestampMatch !== null) {
			// If line contains a timestamp, extract details and push into timestamps array
			const time = timestampMatch[2];
			const timestamp = timestampMatch[3];
			const title = timestampMatch[4] || '';
			timestamps.push({
				time: convertToSeconds(time),
				title: title,
				timePretty: timestamp
			});
		} else {
			filteredLines.push(line);
		}
	});

	const filteredContent = filteredLines.join('\n');

	return { description: filteredContent, timestamps: timestamps };
}

function convertToSeconds(time: string): number {
	const parts = time.split(':').map((part) => parseInt(part));
	let seconds = 0;
	if (parts.length === 3) {
		// hh:mm:ss
		seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
	} else if (parts.length === 2) {
		// hh:ss or m:ss
		seconds = parts[0] * 60 + parts[1];
	} else if (parts.length === 1) {
		// s
		seconds = parts[0];
	}
	return seconds;
}

export function proxyVideoUrl(source: string): string {
	const rawSrc = new URL(source);
	rawSrc.host = import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE.replace('http://', '').replace(
		'https://',
		''
	);

	return rawSrc.toString();
}

export function unsafeRandomItem(array: any[]): any {
	return array[Math.floor(Math.random() * array.length)];
}

export function setWindowQueryFlag(key: string, value: string) {
	const currentPage = get(page);
	currentPage.url.searchParams.set(key, value);
	pushState(currentPage.url, currentPage.state);
}

export function removeWindowQueryFlag(key: string) {
	const currentPage = get(page);
	currentPage.url.searchParams.delete(key);
	pushState(currentPage.url, currentPage.state);
}

export function peerJsOptions(): PeerOptions {
	return {
		host: import.meta.env.VITE_DEFAULT_PEERJS_HOST || '0.peerjs.com',
		path: import.meta.env.VITE_DEFAULT_PEERJS_PATH || '/',
		port: Number(import.meta.env.VITE_DEFAULT_PEERJS_PORT) || 443
	};
}

export function getBestThumbnail(
	images: Image[] | null,
	maxWidthDimension: number = 480,
	maxHeightDimension = 360
): string | null {
	if (images && images.length > 0) {
		images = images.filter(
			(image) => image.width < maxWidthDimension && image.height < maxHeightDimension
		);

		if (images.length === 0) {
			return null;
		}

		images.sort((a, b) => {
			return b.width * b.height - a.width * a.height;
		});

		return images[0].url;
	} else {
		return null;
	}
}
