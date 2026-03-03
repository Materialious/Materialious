import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import he from 'he';
import { get } from 'svelte/store';
import { env } from '$env/dynamic/public';
import {
	invidiousAuthStore,
	backendInUseStore,
	channelCacheStore,
	feedCacheStore,
	invidiousInstanceStore,
	interfaceAndroidUseNativeShare,
	playlistCacheStore,
	rawMasterKeyStore,
	searchCacheStore
} from './store';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { isOwnBackend } from './shared';
import { Browser } from '@capacitor/browser';
import { clearFeedYTjs } from './api/youtubejs/subscriptions';
import { addToast } from './components/Toast.svelte';
import { _ } from './i18n';

export function getPublicEnv(envName: string): string | undefined {
	return env[`PUBLIC_${envName}`] ?? import.meta.env[`VITE_${envName}`];
}

export function isMobile(): boolean {
	const userAgent = navigator.userAgent;

	const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	const isUserAgentMobile =
		/Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

	return (hasTouchSupport && isUserAgentMobile) || Capacitor.getPlatform() === 'android';
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

	addToast({
		data: {
			text: get(_)('player.share.copiedSuccess')
		}
	});
}

export function ensureNoTrailingSlash(url: any): string {
	if (typeof url !== 'string') return '';

	return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function expandSummery(id: string) {
	const element = document.getElementById(id);
	if (element) {
		element.click();
	}
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
		searchParams.set('callback_url', `${location.origin}${resolve('/invidious/auth', {})}`);
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
