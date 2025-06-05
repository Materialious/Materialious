import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n'; // Import to initialize. Important :)
import { initI18n } from '$lib/i18n';
import { getPages } from '$lib/navPages.js';
import { authStore, interfaceDefaultPage } from '$lib/store.js';
import { get } from 'svelte/store';

export const ssr = false;

export async function load({ url }) {
	if (browser) {
		await initI18n();
	}

	if (url.pathname.startsWith('/@')) {
		const username = url.pathname.split('/')[1];

		try {
			const resolvedUrl = await getResolveUrl(`www.youtube.com/${username}`);
			if (resolvedUrl.pageType === 'WEB_PAGE_TYPE_CHANNEL') {
				goto(`/channel/${resolvedUrl.ucid}`);
			}
		} catch {}
	}

	const defaultPage = get(interfaceDefaultPage);

	if (
		defaultPage &&
		defaultPage !== '/' &&
		defaultPage.startsWith('/') &&
		url.pathname === '/' &&
		window.history.length < 3
	) {
		getPages().forEach((page) => {
			if (page.href === defaultPage && (!page.requiresAuth || get(authStore))) {
				goto(defaultPage);
			}
		});
	}
}
