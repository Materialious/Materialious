import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';
import androidTv from '$lib/android/plugins/androidTv';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n';
import { initI18n } from '$lib/i18n';
import { getPages } from '$lib/navPages';
import {
	invidiousAuthStore,
	backendInUseStore,
	invidiousInstanceStore,
	interfaceDefaultPage,
	isAndroidTvStore,
	rawMasterKeyStore,
	hideSearchStore
} from '$lib/store';
import { get, type Writable } from 'svelte/store';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { deserialize } from '@macfja/serializer';
import { isYTBackend } from '$lib/misc';
import { isOwnBackend } from '$lib/shared/index';
import '$lib/fetchProxy';

export const ssr = false;
export const prerender = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	isAndroidTvStore.set((await androidTv.isAndroidTv()).value);

	if (Capacitor.getPlatform() === 'android') {
		const preferenceKey: Record<string, Writable<any>> = {
			invidiousInstance: invidiousInstanceStore,
			authToken: invidiousAuthStore,
			backendInUse: backendInUseStore,
			rawMasterKey: rawMasterKeyStore
		};

		for (const [key, store] of Object.entries(preferenceKey)) {
			const result = await Preferences.get({ key });
			if (result.value !== null) {
				store.set(deserialize(result.value));
			}
		}
	}

	const resolvedRoot = resolve('/', {});

	if (url.pathname.startsWith(resolvedRoot + '@')) {
		const username = url.pathname.substring(resolvedRoot.length).split('/')[0];

		try {
			const resolvedUrl = await getResolveUrl(`www.youtube.com/${username}`);
			if (resolvedUrl.pageType === 'WEB_PAGE_TYPE_CHANNEL') {
				throw redirect(
					302,
					resolve(`/channel/[authorId]`, {
						authorId: resolvedUrl.ucid
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
				throw redirect(302, resolve(defaultPage, {}));
			}
		}
	}

	const isLoginPage = url.pathname.endsWith('/internal/login');
	const isSetupPage = url.pathname.endsWith('/setup');

	if (!isLoginPage) {
		if (isOwnBackend()?.requireAuth && !get(rawMasterKeyStore)) {
			throw redirect(302, resolve('/internal/login', {}));
		}

		if (!get(invidiousInstanceStore) && !isYTBackend() && !isSetupPage) {
			throw redirect(302, resolve('/setup', {}));
		}
	}

	return {};
}
