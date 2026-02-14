import { getUser } from '$lib/server/user';
import { json } from '@sveltejs/kit';
import { isOwnBackend } from '$lib/shared';

export async function GET({ params }) {
	if (!isOwnBackend()?.internalAuth) {
		return new Response('', { status: 500 });
	}

	const user = await getUser(params.userId);
	return json(user.publicPasswordSalts);
}
