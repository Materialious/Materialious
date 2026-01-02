import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import androidTv from '$lib/android/plugins/androidTv';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n'; // Import to initialize. Important :)
import { initI18n } from '$lib/i18n';
import { getPages } from '$lib/navPages';
import { authStore, instanceStore, interfaceDefaultPage, isAndroidTvStore } from '$lib/store';
import { get } from 'svelte/store';
import '$lib/android/http/androidRequests';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deserialize } from '@macfja/serializer';

export const ssr = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	isAndroidTvStore.set((await androidTv.isAndroidTv()).value);

	// Due to race condition with how we set & save persistent store values
	// we manually set stores like auth & instance before load.
	if (Capacitor.getPlatform() === 'android') {
		const instancePreferences = await Preferences.get({ key: 'invidiousInstance' });
		if (instancePreferences.value !== null) {
			instanceStore.set(deserialize(instancePreferences.value));
		}

		const authPreferences = await Preferences.get({ key: 'authToken' });
		if (authPreferences.value !== null) {
			authStore.set(deserialize(authPreferences.value));
		}
	}

	const resolvedRoot = resolve('/', {});
	if (url.pathname.startsWith(resolvedRoot + '@')) {
		const username = url.pathname.substring(resolvedRoot.length).split('/')[0];

		try {
			const resolvedUrl = await getResolveUrl(`www.youtube.com/${username}`);
			if (resolvedUrl.pageType === 'WEB_PAGE_TYPE_CHANNEL') {
				goto(resolve(`/channel/[authorId]`, { authorId: resolvedUrl.ucid }));
			}
		} catch {
			// continue regardless of error
		}
	}

	const defaultPage = get(interfaceDefaultPage);

	if (
		defaultPage &&
		defaultPage !== '/' &&
		defaultPage.startsWith('/') &&
		url.pathname === resolvedRoot &&
		window.history.length < 3
	) {
		getPages().forEach((page) => {
			if (page.href === defaultPage && (!page.requiresAuth || get(authStore))) {
				goto(resolve(defaultPage, {}));
			}
		});
	}
}
