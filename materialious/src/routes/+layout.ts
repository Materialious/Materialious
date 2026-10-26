import { browser } from '$app/env';
import { resolve } from '$app/paths';
import { resolvePath } from '#lib/paths';
import { redirect } from '@sveltejs/kit';
import { getResolveUrl } from '#lib/api/index';
import { resolvePlatform } from '#lib/platform';
import '#lib/i18n/index.js';
import { initI18n } from '#lib/i18n/index';
import { getPages } from '#lib/navPages';
import {
	invidiousAuthStore,
	backendInUseStore,
	invidiousInstanceStore,
	interfaceDefaultPage,
	authTokenStore,
	materialiousBackendStore,
	rawMasterKeyStore,
	filterContentListStore,
	filterContentUrlStore,
	filterContentUrlAutoUpdateStore
} from '#lib/store';
import { get, type Writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deserialize } from '@macfja/serializer';
import { isYTBackend } from '#lib/backend';
import { isOwnBackend } from '#lib/shared/index';
import '#lib/fetchProxy.js';
import { loadContentFilterFromURL } from '#lib/filtering/index';
import { configBackend } from '#lib/api/backend/index';
import { configBackendCache } from '#lib/stores/backend';

export const ssr = false;
export const prerender = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	await resolvePlatform();

	if (Capacitor.getPlatform() === 'android') {
		const preferenceKey: Record<string, Writable<any>> = {
			invidiousInstance: invidiousInstanceStore,
			authToken: invidiousAuthStore,
			backendInUse: backendInUseStore,
			rawMasterKey: rawMasterKeyStore,
			materialiousBackend: materialiousBackendStore,
			materialiousAuthToken: authTokenStore,
			filterContentList: filterContentListStore,
			filterContentUrl: filterContentUrlStore,
			filterContentUrlAutoUpdate: filterContentUrlAutoUpdateStore
		};

		for (const [key, store] of Object.entries(preferenceKey)) {
			const result = await Preferences.get({ key });
			if (result.value !== null) {
				store.set(deserialize(result.value));
			}
		}
	}

	if (get(materialiousBackendStore)) {
		const config = await configBackend();
		if (!config) return;

		configBackendCache.set(config);
	}

	if (get(filterContentUrlAutoUpdateStore)) {
		const filterUrl = get(filterContentUrlStore);
		if (filterUrl) {
			try {
				loadContentFilterFromURL(filterUrl).then((filterList) =>
					filterContentListStore.set(filterList)
				);
			} catch {
				// Continue regardless of error
			}
		}
	}

	const resolvedRoot = resolve('/(app)');

	if (url.pathname.startsWith(resolvedRoot + '@')) {
		const username = url.pathname.substring(resolvedRoot.length).split('/')[0];

		try {
			const resolvedUrl = await getResolveUrl(`www.youtube.com/${username}`);
			if (resolvedUrl.pageType === 'WEB_PAGE_TYPE_CHANNEL') {
				throw redirect(
					302,
					resolve('/(app)/channel/[slug]', {
						slug: resolvedUrl.ucid
					})
				);
			}
		} catch {
			// ignore errors
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
		for (const page of getPages()) {
			if (page.href === defaultPage && (!page.requiresAuth || get(invidiousAuthStore))) {
				throw redirect(302, resolvePath(defaultPage));
			}
		}
	}

	const isLoginPage =
		url.pathname.endsWith('/login/internal') || url.pathname.endsWith('/login/tv');
	const isSetupPage = url.pathname.endsWith('/setup');

	if (!isLoginPage) {
		if (isOwnBackend()?.requireAuth && !get(rawMasterKeyStore)) {
			throw redirect(302, resolve('/(app)/login/internal'));
		}

		if (!get(invidiousInstanceStore) && !isYTBackend() && !isSetupPage) {
			throw redirect(302, resolve('/(app)/setup'));
		}
	}

	return {};
}
