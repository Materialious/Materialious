import { error } from '@sveltejs/kit';
import { PUBLIC_DOWNLOAD_DISABLED, PUBLIC_REQUIRE_BROWSER_COMPANION } from '$app/env/public';

export function assertDownloadEnabled() {
	if (PUBLIC_DOWNLOAD_DISABLED === 'true' || PUBLIC_REQUIRE_BROWSER_COMPANION === 'true') {
		throw error(404, 'Downloads are disabled');
	}
}
