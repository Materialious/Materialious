import { getSequelize } from '$lib/server/database';
import { error, json } from '@sveltejs/kit';
import z from 'zod';
import { Op } from 'sequelize';
import { env } from '$env/dynamic/private';

const zUserHistory = z.object({
	id: z.string().max(255),
	watched: z.coerce.date(),
	progress: z.number().max(115200),
	lengthSeconds: z.number().max(115200),
	title: z.object({
		cipher: z.string().max(255),
		nonce: z.string().max(255)
	}),
	author: z.object({
		cipher: z.string().max(255),
		nonce: z.string().max(255)
	}),
	authorId: z
		.object({
			cipher: z.string().max(255),
			nonce: z.string().max(255)
		})
		.optional(),
	thumbnail: z.object({
		cipher: z.string().max(1000),
		nonce: z.string().max(255)
	}),
	videoId: z.object({
		cipher: z.string().max(255),
		nonce: z.string().max(255)
	})
});

export async function POST({ locals, request }) {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const data = zUserHistory.safeParse(await request.json());

	if (!data.success) throw error(400, data.error.message);

	const history = await getSequelize().UserHistoryTable.findOne({
		where: {
			UserId: locals.userId,
			id: data.data.id
		}
	});

	const toStore = {
		watched: data.data.watched,
		lengthSeconds: data.data.lengthSeconds,
		titleCipher: data.data.title.cipher,
		titleNonce: data.data.title.nonce,
		authorCipher: data.data.author.cipher,
		authorNonce: data.data.author.nonce,
		authorIdCipher: data.data.authorId?.cipher ?? null,
		authorIdNonce: data.data.authorId?.nonce ?? null,
		thumbnailCipher: data.data.thumbnail.cipher,
		thumbnailNonce: data.data.thumbnail.nonce,
		videoIdCipher: data.data.videoId.cipher,
		videoIdNonce: data.data.videoId.nonce
	};

	if (history) {
		await history.update(toStore);
	} else {
		await getSequelize().UserHistoryTable.create({
			UserId: locals.userId,
			id: data.data.id,
			progress: data.data.progress,
			...toStore
		});
	}


  // Cull any history older than HISTORY_CULLING days.
  // -1 disables culling, defaults to 365 days.
  const cullingDays = env.HISTORY_CULLING ? Number(env.HISTORY_CULLING) : 365;
  if (cullingDays >= 0) {
  	const cullingDate = new Date();
    cullingDate.setDate(cullingDate.getDate() - cullingDays);

		getSequelize().UserHistoryTable.destroy({
			where: {
				UserId: locals.userId,
				watched: {
					[Op.lt]: cullingDate
				}
			}
		});
	}

	return new Response();
}

export async function GET({ locals, url }) {
	if (!locals.userId) throw error(401, 'Unauthorized');

	const limit = 100;
	const page = Number(url.searchParams.get('page') ?? 0);

	const videoHashes = url.searchParams.get('videoHashes');
	let videoHashesList: string[] = [];

	if (videoHashes) {
		videoHashesList = videoHashes.split(',');
	}

	const whereClause: any = {
		UserId: locals.userId
	};

	if (videoHashesList.length > 0) {
		whereClause.id = { [Op.in]: videoHashesList };
	}

	const history = await getSequelize().UserHistoryTable.findAll({
		where: whereClause,
		limit,
		offset: page > 0 ? limit * page : undefined,
		order: [['watched', 'DESC']]
	});

	return json(history);
}

export async function DELETE({ locals }) {
	await getSequelize().UserHistoryTable.destroy({
		where: {
			UserId: locals.userId
		}
	});

	return new Response();
}
