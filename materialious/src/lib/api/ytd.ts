import { get } from 'svelte/store';
import type { ReturnYTDislikes } from './model';
import { fetchErrorHandle } from './invidious/request';
import { returnYTDislikesInstanceStore } from '$lib/store';

export async function getDislikesRYD(
	videoId: string,
	fetchOptions?: RequestInit
): Promise<ReturnYTDislikes> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(returnYTDislikesInstanceStore)}/votes?videoId=${videoId}`, fetchOptions)
	);
	return await resp.json();
}
