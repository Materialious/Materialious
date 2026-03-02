import { get } from 'svelte/store';
import type { Image } from './api/model';
import { interfaceAllowInsecureRequests, invidiousInstanceStore } from './store';
import { isYTBackend } from './misc';

export class ImageCache {
	private cache = new Map<string, HTMLImageElement>();

	load(src: string): Promise<HTMLImageElement> {
		if (this.cache.has(src)) {
			return Promise.resolve(this.cache.get(src)!);
		}

		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				this.cache.set(src, img);
				resolve(img);
			};
			img.onerror = reject;
			img.src = src;
		});
	}

	clear() {
		this.cache.clear();
	}
}

export async function insecureRequestImageHandler(source: string): Promise<HTMLImageElement> {
	const img = new Image();
	if (get(interfaceAllowInsecureRequests)) {
		const imgResp = await fetch(source);
		if (!imgResp.ok) {
			img.src = '';
			return img;
		}

		img.src = URL.createObjectURL(await imgResp.blob());
	} else {
		img.src = source;
	}

	return img;
}

export function getBestThumbnail(
	images: Image[] | null,
	maxWidthDimension: number = 480,
	maxHeightDimension = 360
): string {
	if (images && images.length > 0) {
		const imagesFiltered = images.filter(
			(image) => image.width < maxWidthDimension && image.height < maxHeightDimension
		);

		if (imagesFiltered.length === 0) {
			return images[0].url;
		}

		imagesFiltered.sort((a, b) => {
			return b.width * b.height - a.width * a.height;
		});

		return imagesFiltered[0].url;
	} else {
		return '';
	}
}

export function proxyGoogleImage(source: string): string {
	if (source.startsWith('//')) source = `https:${source}`;

	if (isYTBackend()) return source;

	let path: string | undefined;
	try {
		path = new URL(source).pathname;
	} catch {
		// Continue regardless of error
	}

	if (typeof path === 'undefined') return '';

	return `${get(invidiousInstanceStore)}/ggpht${path}`;
}
