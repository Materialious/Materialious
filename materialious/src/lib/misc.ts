import { pushState } from '$app/navigation';
import { page } from '$app/stores';
import he from 'he';
import type Peer from 'peerjs';
import { get } from 'svelte/store';
import { instanceStore, interfaceAllowInsecureRequests } from './store';
import type { Channel, HashTag, Playlist, PlaylistPageVideo, Video, VideoBase } from './api/model';

export function truncate(value: string, maxLength: number = 50): string {
	return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}

export function decodeHtmlCharCodes(str: string): string {
	const { decode } = he;
	return decode(str);
}

export function proxyVideoUrl(source: string): string {
	const rawSrc = new URL(source);
	rawSrc.host = get(instanceStore).replace('http://', '').replace('https://', '');

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

let PeerInstance: typeof Peer;
export async function peerJs(peerId: string): Promise<Peer> {
	// https://github.com/peers/peerjs/issues/819
	if (typeof PeerInstance === 'undefined') {
		PeerInstance = (await import('peerjs')).Peer;
	}
	return new PeerInstance(peerId, {
		host: import.meta.env.VITE_DEFAULT_PEERJS_HOST || '0.peerjs.com',
		path: import.meta.env.VITE_DEFAULT_PEERJS_PATH || '/',
		port: import.meta.env.VITE_DEFAULT_PEERJS_PORT || 443
	});
}

export function ensureNoTrailingSlash(url: any): string {
	if (typeof url !== 'string') return '';

	return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function insecureRequestImageHandler(source: string): Promise<HTMLImageElement> {
	const img = new Image();
	if (get(interfaceAllowInsecureRequests)) {
		const imgResp = await fetch(source);
		if (!imgResp.ok) {
			img.src = '';
		}

		img.src = URL.createObjectURL(await imgResp.blob());
	} else {
		img.src = source;
	}

	return img;
}

export type feedItem = VideoBase | Video | PlaylistPageVideo | Channel | Video | Playlist | HashTag;
export type feedItems = feedItem[];

export function extractUniqueId(item: feedItem): string {
	if ('videoId' in item) {
		return item.videoId;
	} else if ('authorId' in item) {
		return item.authorId;
	} else {
		return item.title;
	}
}

export function excludeDuplicateFeeds(currentItems: feedItems, newItems: feedItems): feedItems {
	const existingIds: string[] = [];

	currentItems.forEach((item) => {
		existingIds.push(extractUniqueId(item));
	});

	const nonDuplicatedNewItems: feedItems = [];
	newItems.forEach((item) => {
		if (!existingIds.includes(extractUniqueId(item))) {
			nonDuplicatedNewItems.push(item);
		}
	});

	return [...nonDuplicatedNewItems, ...currentItems];
}
