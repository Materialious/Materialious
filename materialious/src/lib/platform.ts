import { getPublicEnv } from '#lib/env';
import { Capacitor } from '@capacitor/core';
import androidTv from '#lib/android/plugins/androidTv';

export type Platform = 'web' | 'ios' | 'electron' | 'android' | 'androidTV';

let cachedPlatform: Platform | null = null;
let updateCheckStarted = false;

export async function resolvePlatform(): Promise<Platform> {
	const native = Capacitor.getPlatform();
	if (native !== 'android') return (cachedPlatform = native as Platform);
	if (getPublicEnv('ANDROID_TV_BUILD') === 'true' && !updateCheckStarted) {
		updateCheckStarted = true;
		void import('#lib/android/tvUpdater').then(({ checkForTvUpdate }) => checkForTvUpdate(true));
	}
	const { value } = await androidTv.isAndroidTv();
	return (cachedPlatform = value ? 'androidTV' : 'android');
}

export function getPlatform(): Platform {
	if (cachedPlatform) return cachedPlatform;
	const native = Capacitor.getPlatform();
	if (native !== 'android') return (cachedPlatform = native as Platform);
	void resolvePlatform();
	return (cachedPlatform = 'android');
}

export function isAndroidTv(): boolean {
	return getPlatform() === 'androidTV';
}

export function isAndroid(platform: Platform): boolean {
	return platform === 'android' || platform === 'androidTV';
}
