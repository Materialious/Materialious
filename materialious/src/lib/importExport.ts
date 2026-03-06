import z from 'zod';
import type { Subscription } from './api/model';
import { getChannel, getSubscriptions, postSubscribe } from './api';
import Papa from 'papaparse';
import { downloadStringAsFile } from './misc';

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

const zNewPipeSubs = z.object({
	subscriptions: z.array(
		z.object({
			service_id: z.number(),
			url: z.url(),
			name: z.string()
		})
	)
});

const zYouTubeSubs = z.array(
	z.object({
		snippet: z.object({
			channelId: z.string(),
			title: z.string()
		})
	})
);

const zYouTubeCsvSubs = z.array(
	z.object({
		'Channel ID': z.string(),
		'Channel title': z.string()
	})
);

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

	if (file.name.endsWith('.opml')) {
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
	} else if (file.name.endsWith('.json')) {
		let fileJson: Record<any, any> | undefined;
		try {
			fileJson = JSON.parse(fileContents);
		} catch {
			// Continue regardless
		}

		if (fileJson) {
			const invidiousSubs = zInvidiousSubs.safeParse(fileJson);
			const freetubeSubs = zFreetubeSubs.safeParse(fileJson);
			const newPipeSubs = zNewPipeSubs.safeParse(fileJson);
			const youtubeSubs = zYouTubeSubs.safeParse(fileJson);

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
			} else if (newPipeSubs.success) {
				for (const sub of newPipeSubs.data.subscriptions) {
					const authorId = sub.url.split('/')[4];
					if (typeof authorId !== 'string') continue;
					subsToImport.push({
						author: sub.name,
						authorId
					});
				}
			} else if (youtubeSubs.success) {
				for (const sub of youtubeSubs.data) {
					subsToImport.push({
						author: sub.snippet.title,
						authorId: sub.snippet.channelId
					});
				}
			}
		}
	} else if (file.name.endsWith('.csv')) {
		const csv = Papa.parse(fileContents, { header: true, skipEmptyLines: true });

		if (csv.data.length > 0) {
			const youtubeSubs = zYouTubeCsvSubs.safeParse(csv.data);

			if (youtubeSubs.success) {
				for (const sub of youtubeSubs.data) {
					subsToImport.push({
						author: sub['Channel title'],
						authorId: sub['Channel ID']
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

export async function exportSubscriptionsAsFile(exportType: 'InvidiousJSON' | 'OPML') {
	const subscriptions = await getSubscriptions();

	let data: string | undefined;

	if (exportType === 'InvidiousJSON') {
		const subIds = [];

		for (const sub of subscriptions) {
			subIds.push(sub.authorId);
		}

		data = JSON.stringify({
			subscriptions: subIds
		});
	} else {
		const xmlDoc = document.implementation.createDocument('', '', null);

		const opml = xmlDoc.createElement('opml');
		opml.setAttribute('version', '1.1');

		const body = xmlDoc.createElement('body');

		const mainOutline = xmlDoc.createElement('outline');
		mainOutline.setAttribute('text', 'YouTube Subscriptions');
		mainOutline.setAttribute('title', 'YouTube Subscriptions');

		body.appendChild(mainOutline);

		for (const sub of subscriptions) {
			const outline = xmlDoc.createElement('outline');
			outline.setAttribute('text', sub.author);
			outline.setAttribute('title', sub.author);
			outline.setAttribute('type', 'rss');
			outline.setAttribute(
				'xmlUrl',
				`https://www.youtube.com/feeds/videos.xml?channel_id=${sub.authorId}`
			);

			body.appendChild(outline);
		}

		opml.appendChild(body);
		xmlDoc.appendChild(opml);

		const serializer = new XMLSerializer();

		data = serializer.serializeToString(xmlDoc);
	}

	if (data) {
		downloadStringAsFile(
			data,
			`materialious-export-${new Date().toDateString().replaceAll(' ', '')}.${exportType === 'InvidiousJSON' ? 'json' : 'opml'}`
		);
	}
}
