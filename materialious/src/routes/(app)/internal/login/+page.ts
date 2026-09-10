import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { get } from 'svelte/store';
import { isOwnBackend } from '$lib/shared';
import { materialiousBackendStore } from '$lib/store';

export async function load() {
	if (!isOwnBackend()?.internalAuth && !get(materialiousBackendStore)) {
		goto(resolve('/', {}), { replaceState: true });
	}
}
