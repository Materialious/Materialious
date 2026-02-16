import { goto, pushState } from '$app/navigation';
import { resolve } from '$app/paths';
import he from 'he';
import type Peer from 'peerjs';
import { get } from 'svelte/store';
import { env } from '$env/dynamic/public';
import {
	invidiousAuthStore,
	backendInUseStore,
	channelCacheStore,
	feedCacheStore,
	invidiousInstanceStore,
	interfaceAllowInsecureRequests,
	interfaceAndroidUseNativeShare,
	isAndroidTvStore,
	playlistCacheStore,
	rawMasterKeyStore,
	searchCacheStore
} from './store';
import type {
	Channel,
	HashTag,
	Playlist,
	PlaylistPage,
	PlaylistPageVideo,
	Video,
	VideoBase
} from './api/model';
import { page } from '$app/state';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { isOwnBackend } from './shared';
import { Browser } from '@capacitor/browser';
import { clearFeedYTjs } from './api/youtubejs/subscriptions';

export function isMobile(): boolean {
	const userAgent = navigator.userAgent;

	const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	const isSmallScreen = window.innerWidth < 768;
	const isUserAgentMobile =
		/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

	return (
		(hasTouchSupport && isSmallScreen && isUserAgentMobile) || Capacitor.getPlatform() === 'android'
	);
}

export function isVideoID(videoId: string): boolean {
	const regExp = /^[a-zA-Z0-9_-]{11}$/;
	return regExp.test(videoId);
}

export function truncate(value: string, maxLength: number = 50): string {
	return value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
}

export function decodeHtmlCharCodes(str: string): string {
	const { decode } = he;
	return decode(str);
}

export function unsafeRandomItem(array: any[]): any {
	return array[Math.floor(Math.random() * array.length)];
}

export function setWindowQueryFlag(key: string, value: string) {
	page.url.searchParams.set(key, value);
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	pushState(page.url, page.state);
}

export function removeWindowQueryFlag(key: string) {
	page.url.searchParams.delete(key);
	// eslint-disable-next-line svelte/no-navigation-without-resolve
	pushState(page.url, page.state);
}

let PeerInstance: typeof Peer;
export interface PeerInstance {
	host: string;
	path: string;
	port: number;
}

export function determinePeerJsInstance(): PeerInstance {
	return {
		host:
			import.meta.env.VITE_DEFAULT_PEERJS_HOST || env.PUBLIC_DEFAULT_PEERJS_HOST || '0.peerjs.com',
		path: import.meta.env.VITE_DEFAULT_PEERJS_PATH || env.PUBLIC_DEFAULT_PEERJS_PATH || '/',
		port: import.meta.env.VITE_DEFAULT_PEERJS_PORT || env.PUBLIC_DEFAULT_PEERJS_PORT || 443
	};
}

export async function peerJs(
	id: string,
	instance: PeerInstance = determinePeerJsInstance()
): Promise<Peer> {
	// https://github.com/peers/peerjs/issues/819
	if (typeof PeerInstance === 'undefined') {
		PeerInstance = (await import('peerjs')).Peer;
	}
	return new PeerInstance(id, instance);
}

export async function shareURL(url: string) {
	if (
		Capacitor.getPlatform() === 'android' &&
		(await Share.canShare()).value &&
		get(interfaceAndroidUseNativeShare)
	) {
		await Share.share({ url: url });
	} else {
		await Clipboard.write({ string: url });
	}
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
			return img;
		}

		img.src = URL.createObjectURL(await imgResp.blob());
	} else {
		img.src = source;
	}

	return img;
}

export type feedItem =
	| VideoBase
	| Video
	| PlaylistPageVideo
	| Channel
	| Video
	| Playlist
	| HashTag
	| PlaylistPage;
export type feedItems = feedItem[];

export function extractUniqueId(item: feedItem): string {
	if ('videoId' in item) {
		return item.videoId;
	} else if ('playlistId' in item) {
		return item.playlistId;
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

export function expandSummery(id: string) {
	const element = document.getElementById(id);
	if (element) {
		element.click();
	}
}

export function createVideoUrl(videoId: string, playlistId: string): URL {
	const watchPath = resolve(`/${get(isAndroidTvStore) ? 'tv' : 'watch'}/[videoId]`, {
		videoId: videoId
	});
	const watchUrl = new URL(`${location.origin}${watchPath}`);

	if (playlistId !== '') {
		watchUrl.searchParams.set('playlist', playlistId);
	}

	return watchUrl;
}

export function timeout(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function findElementForTime<T>(
	elements: T[],
	currentTime: number,
	getStartTime: (element: T) => number,
	getEndTime: (element: T) => number
): T | null {
	let left = 0;
	let right = elements.length - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const element = elements[mid];
		const startTime = getStartTime(element);
		const endTime = getEndTime(element);

		// Check if currentTime is within the time range of the element
		if (currentTime >= startTime && currentTime <= endTime) {
			return element;
		}

		// If currentTime is earlier, search the left half
		if (currentTime < startTime) {
			right = mid - 1;
		}
		// If currentTime is later, search the right half
		else {
			left = mid + 1;
		}
	}

	return null;
}

export function isUnrestrictedPlatform(): boolean {
	return isOwnBackend() !== null || Capacitor.isNativePlatform();
}

export function isYTBackend(): boolean {
	return get(backendInUseStore) === 'yt' && isUnrestrictedPlatform();
}

export function clearCaches() {
	feedCacheStore.set({});
	searchCacheStore.set({});
	playlistCacheStore.set({});
	channelCacheStore.set({});
}

export function authProtected() {
	if (!get(invidiousAuthStore) && !isYTBackend()) {
		goto(resolve('/', {}), { replaceState: true });
	}
}

export async function setInvidiousInstance(
	instanceUrl: string | undefined | null
): Promise<boolean> {
	if (typeof instanceUrl !== 'string') {
		return false;
	}

	let invalidInstance = false;

	const instance = ensureNoTrailingSlash(instanceUrl);

	try {
		new URL(instance);
	} catch {
		invalidInstance = true;
	}

	if (invalidInstance) return false;

	let resp;
	try {
		resp = await fetch(`${instance}/api/v1/channels/UCH-_hzb2ILSCo9ftVSnrCIQ`);
	} catch {
		invalidInstance = true;
	}

	if (invalidInstance) return false;

	if (resp && !resp.ok) {
		return false;
	}

	invidiousInstanceStore.set(instance);
	invidiousAuthStore.set(null);

	return true;
}

export async function goToInvidiousLogin() {
	if (!get(invidiousInstanceStore)) return;
	const path = new URL(`${get(invidiousInstanceStore)}/authorize_token`);
	const searchParams = new URLSearchParams({
		scopes: ':feed,:subscriptions*,:playlists*,:history*,:notifications*'
	});
	if (Capacitor.getPlatform() === 'android') {
		searchParams.set('callback_url', 'materialious-auth://');
		path.search = searchParams.toString();
		await Browser.open({ url: path.toString() });
	} else {
		searchParams.set('callback_url', `${location.origin}${resolve('/auth', {})}`);
		path.search = searchParams.toString();
		document.location.href = path.toString();
	}
}

export async function invidiousLogout() {
	invidiousAuthStore.set(null);
	goto(resolve('/', {}));
}

export async function materialiousLogout() {
	if (isYTBackend()) {
		await clearFeedYTjs();
	}

	if (isOwnBackend()?.internalAuth) {
		fetch('/api/user/logout', { method: 'DELETE' });
		rawMasterKeyStore.set(undefined);
	}

	goto(resolve('/', {}));
}
