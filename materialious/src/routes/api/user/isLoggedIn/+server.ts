import { error } from '@sveltejs/kit';

export async function GET({ locals }) {
	if (!locals.userId) {
		throw error(401);
	}

	return new Response();
}
