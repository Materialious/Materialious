import { localDb } from '$lib/dexie';
import { logoutStores } from '$lib/misc';
import { cleanNumber } from '$lib/numbers';
import { relativeTimestamp } from '$lib/time';
import { get } from 'svelte/store';
import type { Feed, Subscription, Thumbnail } from '../model';
import { getChannelYTjs } from './channel';
import { engineCooldownYTStore, engineCullYTStore } from '$lib/store';

export async function getSubscriptionsYTjs(): Promise<Subscription[]> {
	const subscriptions: Subscription[] = [];

	await localDb.channelSubscriptions.each((subscription) => {
		subscriptions.push({
			author: subscription.channelName,
			authorId: subscription.channelId
		});
	});

	return subscriptions;
}

export async function amSubscribedYTjs(authorId: string): Promise<boolean> {
	return (await localDb.channelSubscriptions.where('channelId').equals(authorId).count()) > 0;
}

export async function postSubscribeYTjs(authorId: string) {
	const channel = await getChannelYTjs(authorId);

	try {
		await localDb.channelSubscriptions.add({
			channelId: authorId,
			channelName: channel.author,
			lastRSSFetch: new Date(0)
		});
	} catch {
		// Continue regardless
	}

	// Store channel into db in background
	parseChannelRSS(authorId);
}

export async function deleteUnsubscribeYTjs(authorId: string) {
	await localDb.channelSubscriptions.where('channelId').equals(authorId).delete();
	await localDb.subscriptionFeed.where('authorId').equals(authorId).delete();
	logoutStores();
}

export async function parseChannelRSS(channelId: string): Promise<void> {
	const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

	const response = await fetch(feedUrl);
	const text = await response.text();

	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(text, 'text/xml');
	const entries = xmlDoc.getElementsByTagName('entry');

	for (const entry of entries) {
		const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent || '';
		const title = entry.getElementsByTagName('title')[0]?.textContent || 'Untitled';
		const description =
			entry.getElementsByTagName('media:description')[0]?.textContent || 'No description available';
		const descriptionHtml = description;
		const publishedAt = new Date(
			entry.getElementsByTagName('published')[0]?.textContent || new Date()
		);
		const published = publishedAt.getTime();
		const publishedText = relativeTimestamp(published, false);
		const author =
			entry.getElementsByTagName('author')[0]?.getElementsByTagName('name')[0]?.textContent ||
			'Unknown Author';
		const authorId =
			entry
				.getElementsByTagName('author')[0]
				?.getElementsByTagName('uri')[0]
				?.textContent.split('/')[4] || '';

		const authorUrl = authorId ? `/channel/${authorId}` : '';
		const authorVerified = false;

		// Extracting video thumbnails
		const videoThumbnails: Thumbnail[] = Array.from(
			entry.getElementsByTagName('media:group')[0]?.getElementsByTagName('media:thumbnail') || []
		).map((thumbElement) => ({
			url: thumbElement.getAttribute('url') || '',
			width: parseInt(thumbElement.getAttribute('width') || '0'),
			height: parseInt(thumbElement.getAttribute('height') || '0')
		}));

		const liveNow = false;
		const isUpcoming = false;
		const premium = false;
		const lengthSeconds = 0;
		const viewCountText =
			entry.getElementsByTagName('media:statistics')[0]?.getAttribute('views') || '0';
		const viewCount = parseInt(viewCountText) || 0;

		try {
			await localDb.subscriptionFeed.add({
				type: 'video',
				videoId,
				title,
				videoThumbnails,
				author,
				authorId,
				description,
				descriptionHtml,
				published,
				publishedText,
				liveNow,
				premium,
				isUpcoming,
				lengthSeconds,
				viewCountText: cleanNumber(viewCount),
				viewCount,
				authorUrl,
				authorVerified
			});
		} catch {
			// Continue regardless of error
		}

		await localDb.channelSubscriptions.where('channelId').equals(channelId).modify({
			lastRSSFetch: new Date()
		});
	}
}

export async function getFeedYTjs(): Promise<Feed> {
	const channelSubscriptions = await localDb.channelSubscriptions.toArray();

	const toUpdatePromises: Promise<void>[] = [];

	const now = new Date();
	for (const channel of channelSubscriptions) {
		const lastRSSFetch = new Date(channel.lastRSSFetch);
		const timeDifference = now.getTime() - lastRSSFetch.getTime();
		const cooldownTime = get(engineCooldownYTStore) * 60 * 60 * 1000;
		if (timeDifference > cooldownTime) {
			toUpdatePromises.push(parseChannelRSS(channel.channelId));
		}
	}

	if (toUpdatePromises) {
		await Promise.all(toUpdatePromises);
	}

	const videos = await localDb.subscriptionFeed.toArray();
	videos.sort((a, b) => b.published - a.published);

	const cullAfter = get(engineCullYTStore);

	if (videos.length > cullAfter) {
		const videosToDelete = videos.slice(cullAfter);
		const videoIdsToDelete = videosToDelete.map((video) => video.videoId);

		await localDb.subscriptionFeed.where('id').anyOf(videoIdsToDelete).delete();
	}

	return {
		notifications: [],
		videos: videos
	};
}
