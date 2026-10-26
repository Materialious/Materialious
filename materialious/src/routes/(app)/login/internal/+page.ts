import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isOwnBackend } from '#lib/shared/index';

export async function load() {
	if (!isOwnBackend()?.internalAuth) {
		goto(resolve('/(app)'), { replace: true });
	}
}
