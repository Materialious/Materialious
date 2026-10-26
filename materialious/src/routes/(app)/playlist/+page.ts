import { resolve } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';

export async function load({ url }) {
	const playlistId = url.searchParams.get('list');
	if (playlistId) {
		throw redirect(302, resolve('/(app)/playlist/[slug]', { slug: playlistId }));
	} else {
		error(404);
	}
}
