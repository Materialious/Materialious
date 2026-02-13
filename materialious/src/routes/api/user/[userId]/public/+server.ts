import { getUser } from '$lib/backendOnly/user';
import { json } from '@sveltejs/kit';

export async function GET({ params }) {
	const user = await getUser(params.userId);
	return json(user.publicPasswordSalts);
}
