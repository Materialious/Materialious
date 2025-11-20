import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import androidTv from '$lib/android/plugins/androidTv';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n'; // Import to initialize. Important :)
import { initI18n } from '$lib/i18n';
import { getPages } from '$lib/navPages';
import { authStore, interfaceDefaultPage, isAndroidTvStore } from '$lib/store';
import { get } from 'svelte/store';

export const ssr = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	isAndroidTvStore.set((await androidTv.isAndroidTv()).value);

	const resolvedRoot = resolve('/', {});
	if (url.pathname.startsWith(resolvedRoot + '@')) {
		const username = url.pathname.substring(resolvedRoot.length).split('/')[0];

		try {
			const resolvedUrl = await getResolveUrl(`www.youtube.com/${username}`);
			if (resolvedUrl.pageType === 'WEB_PAGE_TYPE_CHANNEL') {
				goto(resolve(`/channel/[authorId]`, { authorId: resolvedUrl.ucid }));
			}
		} catch {}
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
