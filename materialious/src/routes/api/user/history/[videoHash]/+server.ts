import { getSequelize } from '#lib/server/database';
import { error } from '@sveltejs/kit';
import z from 'zod';

const zUserHistoryUpdate = z
	.object({
		watched: z.coerce.date().optional(),
		progress: z.number().max(115200).optional()
	})
	.transform((data) => {
		return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
	});

export async function POST({ locals, request, params }) {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const data = zUserHistoryUpdate.safeParse(await request.json());
	if (!data.success) throw error(400, data.error.message);

	await getSequelize().UserHistoryTable.update(data.data, {
		where: { UserId: locals.userId, id: params.videoHash }
	});

	return new Response();
}

export async function DELETE({ locals, params }) {
	if (!locals.userId) throw error(401, 'Unauthorized');

	await getSequelize().UserHistoryTable.destroy({
		where: { UserId: locals.userId, id: params.videoHash }
	});

	return new Response();
}

export async function GET({ locals, params }) {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const history = await getSequelize().UserHistoryTable.findOne({
		where: { UserId: locals.userId, id: params.videoHash }
	});

	if (!history) throw error(404);

	return Response.json(history);
}
