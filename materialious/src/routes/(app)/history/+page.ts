import { resolve } from '$app/paths';
import { getWatchHistoryBackend } from '$lib/api/backend/history';
import { isOwnBackend } from '$lib/shared';
import { rawMasterKeyStore } from '$lib/store';
import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load() {
	if (!isOwnBackend()?.internalAuth || !get(rawMasterKeyStore))
		throw redirect(302, resolve('/', {}));

	return { videos: await getWatchHistoryBackend() };
}
