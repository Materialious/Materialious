import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isYTBackend } from '$lib/misc';
import { instanceStore } from '$lib/store';
import { get } from 'svelte/store';

export async function load() {
	if (isYTBackend() || get(instanceStore)) {
		goto(resolve('/', {}), { replaceState: true });
	}
}
