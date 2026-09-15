import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isAndroidTv } from '$lib/utils';

export async function load() {
	if (!isAndroidTv()) {
		goto(resolve('/', {}), { replaceState: true });
	}
}
