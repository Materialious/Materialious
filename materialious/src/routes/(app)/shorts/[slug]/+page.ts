import { resolve } from '$app/paths';
import { redirect } from '@sveltejs/kit';

export async function load({ params }) {
	throw redirect(302, resolve('/watch/[videoId]', { videoId: params.slug }));
}
