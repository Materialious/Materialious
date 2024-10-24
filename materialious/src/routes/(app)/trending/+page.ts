import { getTrending } from '$lib/api/index.';
import type { Video } from '$lib/api/model';
import { error } from '@sveltejs/kit';

export async function load() {
	let trending: Video[];
	try {
		trending = await getTrending();
	} catch (errorMessage: any) {
		error(500, errorMessage);
	}

	return { trending: trending };
}
