import { getUser } from '#lib/server/user';

export async function GET({ locals }) {
	const user = await getUser(locals.userId);

	return Response.json({
		subscriptions: await user.subscriptions()
	});
}
