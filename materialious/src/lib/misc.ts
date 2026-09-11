import he from 'he';
import { get } from 'svelte/store';
import { env } from '$env/dynamic/public';
import {
	authTokenStore,
	backendInUseStore,
	interfaceAndroidUseNativeShare,
	isAndroidTvStore,
	materialiousBackendStore,
	rawMasterKeyStore
} from './store';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { isOwnBackend } from './shared';
import { addToast } from './components/Toast.svelte';
import { _ } from './i18n';
import { FileSharer } from '@capgo/capacitor-file-sharer';
import { Buffer } from 'buffer';

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

export function getMaterialiousBackendUrl(): string {
	const remote = get(materialiousBackendStore);
	if (remote) return ensureNoTrailingSlash(remote);
	return '';
}

export function getMaterialiousAuthHeaders(): HeadersInit {
	const token = get(authTokenStore);
	return token !== undefined ? { Authorization: `Bearer ${token}` } : {};
}

export function isMaterialiousAccountActive(): boolean {
	if (!get(rawMasterKeyStore)) return false;
	return !!isOwnBackend()?.internalAuth;
}

export function remoteMaterialiousSupported(): boolean {
	return Capacitor.getPlatform() === 'electron' || Capacitor.getPlatform() === 'android';
}

export function isYTBackend(): boolean {
	return get(backendInUseStore) === 'yt' && isUnrestrictedPlatform();
}

export function isAndroidTv(): boolean {
	return get(isAndroidTvStore);
}

export function blobToBase64(blob: Blob): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export async function downloadStringAsFile(content: string, filename: string) {
	const prefixedName = `${new Date().toDateString().replaceAll(' ', '')}-${filename}`;
	const blob = new Blob([content]);

	if (Capacitor.getPlatform() === 'android') {
		try {
			await FileSharer.save({
				filename: prefixedName,
				contentType: 'text/plain',
				base64Data: Buffer.from(content).toString('base64'),
				android: {
					saveDirectory: 'downloads',
				},
			});

			addToast({
				data: {
					text: get(_)('downloadedCompletedAndroid')
				}
			});
		} catch (errorMsg) {
			addToast({
				data: {
					text: errorMsg instanceof Error ? errorMsg.message : String(errorMsg)
				}
			});
		}
		return;
	}

	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = prefixedName;

	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

export const keyCodeMap: Record<string, number> = {
	ArrowLeft: 37,
	ArrowRight: 39,
	ArrowUp: 38,
	ArrowDown: 40,
	Enter: 13
};
