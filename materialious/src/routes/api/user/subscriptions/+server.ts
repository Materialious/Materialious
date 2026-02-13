import { getUser } from '$lib/server/user';
import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
	const user = await getUser(locals.userId);

	return json({
		subscriptions: await user.subscriptions()
	});
}
