import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { isYTBackend } from '$lib/misc';
import { invidiousInstanceStore } from '$lib/store';
import { get } from 'svelte/store';

export async function load() {
	if (isYTBackend() || get(invidiousInstanceStore)) {
		goto(resolve('/', {}), { replaceState: true });
	}
}
