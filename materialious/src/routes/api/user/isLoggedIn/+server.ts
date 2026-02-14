import { getUser } from '$lib/server/user.js';
import { error } from '@sveltejs/kit';

export async function GET({ locals }) {
	if (!locals.userId) {
		throw error(401);
	}

	await getUser(locals.userId);

	return new Response();
}
