import { getUser } from '$lib/server/user';

export async function DELETE({ locals }) {
	const user = await getUser(locals.userId);
	await user.delete();

	return new Response();
}
