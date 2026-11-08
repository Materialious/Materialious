import { get } from 'svelte/store';
import type { Image } from './api/model';
import { invidiousInstanceStore } from './store';
import { isYTBackend } from './backend';
import { Capacitor } from '@capacitor/core';
import { fetchProxied } from './fetchProxy';

const proxiedImageUrls = new Map<string, string>();
const MAX_CACHED_PROXY_IMAGES = 128;

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

export function getBestLandscapeThumbnail(images: Image[] | null): string {
	if (!images || images.length === 0) return '';

	const landscape = images.filter(
		(image) =>
			image.width > 0 && image.height > 0 && Math.abs(image.width / image.height - 16 / 9) < 0.15
	);

	if (landscape.length === 0) return getBestThumbnail(images, 500, 500);

	landscape.sort((a, b) => b.width * b.height - a.width * a.height);
	return landscape[0].url;
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

export async function imageHandleCors(source: string): Promise<string> {
	if (!source) return '';
	if (Capacitor.getPlatform() !== 'android') return source;

	const cached = proxiedImageUrls.get(source);
	if (cached) return cached;

	const response = await fetchProxied(source);
	if (!response.ok) throw new Error(`Image proxy request failed: ${response.status}`);

	const objectUrl = URL.createObjectURL(await response.blob());
	proxiedImageUrls.set(source, objectUrl);
	if (proxiedImageUrls.size > MAX_CACHED_PROXY_IMAGES) {
		const oldestKey = proxiedImageUrls.keys().next().value;
		if (oldestKey) {
			URL.revokeObjectURL(proxiedImageUrls.get(oldestKey)!);
			proxiedImageUrls.delete(oldestKey);
		}
	}
	return objectUrl;
}
