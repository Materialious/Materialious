import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { getResolveUrl } from '$lib/api';
import '$lib/i18n'; // Import to initialize. Important :)
import { locale, waitLocale } from 'svelte-i18n';

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

	if (browser) {
		locale.set(window.navigator.language);
	}
	await waitLocale();
}
