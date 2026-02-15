import { persistedStoreKeys } from '$lib/externalSettings/settings.js';
import { getUser } from '$lib/server/user.js';
import { error, json } from '@sveltejs/kit';
import z from 'zod';

async function keyAllowed(key: string) {
	if (!persistedStoreKeys.includes(key)) throw error(400);
}

export async function GET({ locals, params }) {
	keyAllowed(params.key);

	const user = await getUser(locals.userId);

	return json(await user.getKeyValue(params.key));
}

export async function DELETE({ locals, params }) {
	keyAllowed(params.key);

	const user = await getUser(locals.userId);

	await user.deleteKeyValue(params.key);

	return new Response();
}

const zUpdateKeyStore = z.object({
	valueCipher: z.string().max(1000),
	valueNonce: z.string().max(255)
});

export async function POST({ locals, params, request }) {
	keyAllowed(params.key);

	const user = await getUser(locals.userId);

	const keyValue = zUpdateKeyStore.safeParse(await request.json());

	if (!keyValue.success) throw error(400);

	await user.addOrUpdateKeyValue(params.key, keyValue.data.valueCipher, keyValue.data.valueNonce);

	return new Response();
}
