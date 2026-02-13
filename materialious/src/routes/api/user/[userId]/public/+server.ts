import { getUser } from '$lib/backendOnly/user';
import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
	const user = await getUser(locals.userId);
	return json(user.publicPasswordSalts);
}
