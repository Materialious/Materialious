import { getUser } from '$lib/server/user';
import { error, json } from '@sveltejs/kit';
import z from 'zod';

const zSubscriptionCreate = z.object({
	channelIdCipher: z.string().max(255),
	channelIdNonce: z.string().max(255),
	channelNameCipher: z.string().max(255),
	channelNameNonce: z.string().max(255)
});

export async function POST({ locals, request, params }) {
	const subscription = zSubscriptionCreate.safeParse(await request.json());

	if (!subscription.success) error(400);

	const user = await getUser(locals.userId);
	await user.addSubscription({
		...subscription.data,
		id: params.id,
		lastRSSFetch: new Date(0)
	});

	return new Response();
}

export async function PATCH({ locals, params }) {
	const user = await getUser(locals.userId);
	await user.subscriptionRssUpdated(params.id);

	return new Response();
}

export async function DELETE({ locals, params }) {
	const user = await getUser(locals.userId);
	await user.removeSubscription(params.id);

	return new Response();
}

export async function GET({ locals, params }) {
	const user = await getUser(locals.userId);

	return json({
		amSubscribed: await user.amSubscribed(params.id)
	});
}
