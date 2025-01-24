import { pushState } from '$app/navigation';
import { page } from '$app/stores';
import he from 'he';
import type Peer from 'peerjs';
import { get } from 'svelte/store';
import { instanceStore } from './store';

export function truncate(value: string, maxLength: number = 50): string {
	return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}

export interface PhasedDescription {
	description: string;
	timestamps: { title: string; time: number; timePretty: string; }[];
}

export function decodeHtmlCharCodes(str: string): string {
	const { decode } = he;
	return decode(str);
}

export function proxyVideoUrl(source: string): string {
	const rawSrc = new URL(source);
	rawSrc.host = get(instanceStore).replace('http://', '').replace(
		'https://',
		''
	);

	return rawSrc.toString();
}

export function pullBitratePreference(): number {
	const vidstack = localStorage.getItem('video-player');

	if (vidstack) {
		const vidstackSettings = JSON.parse(vidstack);
		if (vidstackSettings.quality && vidstackSettings.quality.bitrate) {
			return vidstackSettings.quality.bitrate;
		}
	}

	return -1;
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
	return new PeerInstance(
		peerId,
		{
			host: import.meta.env.VITE_DEFAULT_PEERJS_HOST || '0.peerjs.com',
			path: import.meta.env.VITE_DEFAULT_PEERJS_PATH || '/',
			port: import.meta.env.VITE_DEFAULT_PEERJS_PORT || 443
		}
	);
}

export function ensureNoTrailingSlash(url: any): string {
	if (typeof url !== 'string') return '';

	return url.endsWith('/') ? url.slice(0, -1) : url;
}
