import z from 'zod';
import type { Subscription } from './api/model';
import { getChannel, postSubscribe } from './api';

const zInvidiousSubs = z.object({
	subscriptions: z.array(z.string())
});

const zFreetubeSubs = z.object({
	subscriptions: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			thumbnail: z.string()
		})
	)
});

export async function importSubscriptions(subscriptions: Subscription[]) {
	const subPromises: Promise<void>[] = [];
	for (const sub of subscriptions) {
		subPromises.push(postSubscribe(sub.authorId, sub.author));
	}

	await Promise.all(subPromises);
}

export async function importSubscriptionsFromFile(file: File) {
	const fileContents = await file.text();

	const subsToImport: Subscription[] = [];

	if (fileContents.startsWith('<opml')) {
		const parser = new DOMParser();
		const xmlDoc = parser.parseFromString(fileContents, 'text/xml');

		const opmlSubs = xmlDoc.getElementsByTagName('outline');

		for (const sub of opmlSubs) {
			const channelUrl = sub.getAttribute('xmlUrl');
			const channelName = sub.getAttribute('text') || sub.getAttribute('title');

			if (!channelUrl || !channelName) continue;

			let channelUrlObj: URL | undefined;

			try {
				channelUrlObj = new URL(channelUrl);
			} catch {
				// Handled outsidde of error
			}

			if (!channelUrlObj) continue;

			let channelId: string | null | undefined = channelUrlObj.searchParams.get('channel_id');
			if (!channelId) {
				channelId = channelUrlObj.pathname.split('/')[3];
			}

			if (typeof channelId !== 'string') continue;

			subsToImport.push({
				author: channelName,
				authorId: channelId
			});
		}
	} else {
		let fileJson: Record<any, any> | undefined;
		try {
			fileJson = JSON.parse(fileContents);
		} catch {
			// Continue regardless
		}

		if (fileJson) {
			const invidiousSubs = zInvidiousSubs.safeParse(fileJson);
			const freetubeSubs = zFreetubeSubs.safeParse(fileJson);

			if (invidiousSubs.success) {
				for (const authorId of invidiousSubs.data.subscriptions) {
					try {
						const channel = await getChannel(authorId);
						subsToImport.push({
							authorId,
							author: channel.author
						});
					} catch {
						// Continue regardless
					}
				}
			} else if (freetubeSubs.success) {
				for (const sub of freetubeSubs.data.subscriptions) {
					subsToImport.push({
						author: sub.name,
						authorId: sub.id
					});
				}
			}
		}
	}

	if (subsToImport.length > 0) {
		await importSubscriptions(subsToImport);
		return;
	}

	throw new Error('Unable to determine imported file type');
}
