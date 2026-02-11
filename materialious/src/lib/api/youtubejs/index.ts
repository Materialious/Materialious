import { interfaceRegionStore } from '$lib/store';
import { USER_AGENT } from 'bgutils-js';
import { get } from 'svelte/store';
import Innertube, { UniversalCache } from 'youtubei.js';

let innertube: Innertube | undefined;

export async function getInnertube(): Promise<Innertube> {
	if (innertube) return innertube;

	innertube = await Innertube.create({
		fetch: fetch,
		cache: new UniversalCache(true),
		location: get(interfaceRegionStore),
		user_agent: USER_AGENT
	});

	return innertube;
}
