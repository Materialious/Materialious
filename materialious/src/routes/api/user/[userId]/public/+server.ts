import { getUser } from '#lib/server/user';
import { isOwnBackend } from '#lib/shared/index';

export async function GET({ params }) {
	if (!isOwnBackend()?.internalAuth) {
		return new Response('', { status: 500 });
	}

	const user = await getUser(params.userId);
	return Response.json(user.publicPasswordSalts);
}
