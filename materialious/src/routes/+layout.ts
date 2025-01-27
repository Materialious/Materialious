import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n'; // Import to initialize. Important :)
import { getPages } from '$lib/navPages.js';
import { authStore, interfaceDefaultPage } from '$lib/store.js';
import { locale, waitLocale } from 'svelte-i18n';
import { get } from 'svelte/store';

export let ssr = false;

export async function load({ url }) {
	if (url.pathname.startsWith('/@')) {
		const username = url.pathname.split('/')[1];

		try {
			const resolvedUrl = await getResolveUrl(`www.youtube.com/${username}`);
			if (resolvedUrl.pageType === 'WEB_PAGE_TYPE_CHANNEL') {
				goto(`/channel/${resolvedUrl.ucid}`);
			}
		} catch { }
	}

	const defaultPage = get(interfaceDefaultPage);

	if (
		defaultPage &&
		defaultPage !== '/' &&
		defaultPage.startsWith('/') &&
		url.pathname === '/'
	) {
		getPages().forEach((page) => {
			if (page.href === defaultPage && (!page.requiresAuth || get(authStore))) {
				goto(defaultPage);
			}
		});
	}

	if (browser) {
		locale.set(window.navigator.language);
	}
	await waitLocale();
}
