import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import androidTv from '$lib/android/plugins/androidTv';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n'; // Import to initialize. Important :)
import { initI18n } from '$lib/i18n';
import { getPages } from '$lib/navPages';
import {
	authStore,
	backendInUseStore,
	instanceStore,
	interfaceDefaultPage,
	isAndroidTvStore
} from '$lib/store';
import { get, type Writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deserialize } from '@macfja/serializer';
import { isYTBackend } from '$lib/misc.js';

export const ssr = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	isAndroidTvStore.set((await androidTv.isAndroidTv()).value);

	// Due to race condition with how we set & save persistent store values
	// we manually set stores like auth & instance before load.
	if (Capacitor.getPlatform() === 'android') {
		const preferenceKey: Record<string, Writable<any>> = {
			invidiousInstance: instanceStore,
			authToken: authStore,
			backendInUse: backendInUseStore
		};

		for (const [key, store] of Object.entries(preferenceKey)) {
			const result = await Preferences.get({ key: key });
			if (result.value !== null) store.set(deserialize(result.value));
		}
	}

	if (!get(instanceStore) && !isYTBackend() && !url.pathname.startsWith('/setup')) {
		goto(resolve('/setup', {}), { replaceState: true });
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
