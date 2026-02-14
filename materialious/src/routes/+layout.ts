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
	isAndroidTvStore,
	rawMasterKeyStore
} from '$lib/store';
import { get, type Writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deserialize } from '@macfja/serializer';
import { isYTBackend } from '$lib/misc.js';
import { isOwnBackend } from '$lib/shared/index.js';

export const ssr = false;
export const prerender = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	isAndroidTvStore.set((await androidTv.isAndroidTv()).value);

	if (Capacitor.getPlatform() === 'android') {
		// Due to race condition with how we set & save persistent store values
		// we manually set stores like auth & instance before load.
		const preferenceKey: Record<string, Writable<any>> = {
			invidiousInstance: instanceStore,
			authToken: authStore,
			backendInUse: backendInUseStore,
			rawMasterKey: rawMasterKeyStore
		};

		for (const [key, store] of Object.entries(preferenceKey)) {
			const result = await Preferences.get({ key: key });
			if (result.value !== null) store.set(deserialize(result.value));
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

	const isLoginPage = url.pathname.endsWith('/internal/login');

	if (!isLoginPage) {
		if (isOwnBackend()?.requireAuth && !get(rawMasterKeyStore)) {
			goto(resolve('/internal/login', {}), { replaceState: true });
		} else if (!get(instanceStore) && !isYTBackend() && !url.pathname.endsWith('/setup')) {
			goto(resolve('/setup', {}), { replaceState: true });
		}
	}
}
