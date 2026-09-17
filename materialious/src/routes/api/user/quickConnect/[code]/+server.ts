import { error, json } from '@sveltejs/kit';
import { isOwnBackend } from '$lib/shared';
import { deleteQuickConnectSession, getQuickConnectSession } from '$lib/server/quickConnect';

export async function GET({ locals, params }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	const session = await getQuickConnectSession(params.code);
	if (!session) throw error(404);

	const status = session.credentialsCipher
		? 'completed'
		: session.receiverPublicKey
			? 'awaiting'
			: 'pending';

	if (locals.userId) {
		return json({
			status,
			receiverPublicKey: session.receiverPublicKey
		});
	}

	return json({ status });
}

export async function DELETE({ params }) {
	if (!isOwnBackend()?.internalAuth || !isOwnBackend()?.quickConnect) {
		throw error(500);
	}

	await deleteQuickConnectSession(params.code);

	return new Response();
}
