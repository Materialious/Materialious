import { get } from 'svelte/store';
import { fetchErrorHandle } from './invidious/request';
import { deArrowInstanceStore, deArrowThumbnailInstanceStore } from '$lib/store';
import type { DeArrow } from './model';

export async function getDeArrow(videoId: string, fetchOptions?: RequestInit): Promise<DeArrow> {
	const resp = await fetchErrorHandle(
		await fetch(`${get(deArrowInstanceStore)}/api/branding?videoID=${videoId}`, fetchOptions)
	);
	return await resp.json();
}

export async function getThumbnailDeArrow(
	videoId: string,
	time: number,
	fetchOptions?: RequestInit
): Promise<string> {
	const resp = await fetchErrorHandle(
		await fetch(
			`${get(deArrowThumbnailInstanceStore)}/api/v1/getThumbnail?videoID=${videoId}&time=${time}`,
			fetchOptions
		)
	);
	return URL.createObjectURL(await resp.blob());
}
