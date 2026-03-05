import he from 'he';
import { get } from 'svelte/store';
import { env } from '$env/dynamic/public';
import { backendInUseStore, interfaceAndroidUseNativeShare } from './store';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { isOwnBackend } from './shared';
import { addToast } from './components/Toast.svelte';
import { _ } from './i18n';

export function getPublicEnv(envName: string): string | undefined {
	const envValue = env[`PUBLIC_${envName}`] ?? import.meta.env[`VITE_${envName}`];
	if (envValue === '') return;
	return envValue;
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
