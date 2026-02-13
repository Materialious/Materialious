import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isOwnBackend } from '$lib/shared';

export async function load() {
	if (!isOwnBackend()?.internalAuth) {
		goto(resolve('/', {}), { replaceState: true });
	}
}
