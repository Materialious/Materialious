import { error } from '@sveltejs/kit';
import { isOwnBackend } from '#lib/shared/index';
import { createQuickConnectSession } from '#lib/server/quickConnect';

export async function POST({ locals }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	if (!locals.userId) throw error(401);

	return Response.json(await createQuickConnectSession());
}
