import { localDb, type ChannelSubscriptions } from '#lib/dexie';
import { cleanNumber } from '#lib/numbers';
import { relativeTimestamp } from '#lib/time';
import { get } from 'svelte/store';
import type { Feed, Subscription, Thumbnail, Video } from '../model';
import { getChannelYTjs } from './channel';
import {
	engineCooldownYTStore,
	engineCullYTStore,
	engineMaxConcurrentChannelsStore,
	rawMasterKeyStore
} from '#lib/store';
import { getSubscriptionsBackend } from '../backend/subscriptions';

const REQUEST_SPACING_MS = 1000;
const MAX_CONCURRENT_REQUESTS = 4;
const REQUEST_TIMEOUT_MS = 15000;
const GLOBAL_RETRY_KEY = 'materialiousRSSRetryAt';

type QueuedRequest = { channelId: string; resolve: (success: boolean) => void };

let refreshPromise: Promise<void> | null = null;
let activeRequests = 0;
let nextRequestAt = 0;
let queueTimer: ReturnType<typeof setTimeout> | null = null;
let updateTimer: ReturnType<typeof setTimeout> | null = null;
let memoryGlobalRetryAt = 0;
const requestQueue: QueuedRequest[] = [];
const pendingChannels = new Map<string, Promise<boolean>>();
const unsubscribedChannels = new Set<string>();
const feedUpdateListeners = new Set<() => void>();

function globalRetryAt(): number {
	try {
		return Math.max(memoryGlobalRetryAt, Number(localStorage.getItem(GLOBAL_RETRY_KEY)) || 0);
	} catch {
		return memoryGlobalRetryAt;
	}
}

function setGlobalRetryAt(timestamp: number) {
	memoryGlobalRetryAt = Math.max(globalRetryAt(), timestamp);
	try {
		localStorage.setItem(GLOBAL_RETRY_KEY, String(memoryGlobalRetryAt));
	} catch {
		// Request spacing still applies when storage is unavailable.
	}
}

function notifyFeedUpdated() {
	if (updateTimer) return;
	updateTimer = setTimeout(() => {
		updateTimer = null;
		for (const listener of feedUpdateListeners) listener();
	}, 500);
}

export function onSubscriptionFeedUpdated(listener: () => void): () => void {
	feedUpdateListeners.add(listener);
	return () => feedUpdateListeners.delete(listener);
}

export function cancelChannelRSS(channelId: string) {
	unsubscribedChannels.add(channelId);
}

export function resumeChannelRSS(channelId: string) {
	unsubscribedChannels.delete(channelId);
}

function pumpQueue() {
	if (queueTimer || requestQueue.length === 0) return;
	if (globalRetryAt() > Date.now()) {
		for (const request of requestQueue.splice(0)) request.resolve(false);
		return;
	}
	const configured = Number(get(engineMaxConcurrentChannelsStore));
	const maxConcurrent = Math.min(MAX_CONCURRENT_REQUESTS, Math.max(1, configured || 1));
	if (activeRequests >= maxConcurrent) return;
	const delay = nextRequestAt - Date.now();
	if (delay > 0) {
		queueTimer = setTimeout(() => {
			queueTimer = null;
			pumpQueue();
		}, delay);
		return;
	}
	const request = requestQueue.shift();
	if (!request) return;
	activeRequests++;
	nextRequestAt = Date.now() + REQUEST_SPACING_MS;
	void fetchChannelRSS(request.channelId)
		.then(request.resolve, (error) => {
			console.error('Failed to update subscription RSS', error);
			request.resolve(false);
		})
		.finally(() => {
			activeRequests--;
			pumpQueue();
		});
	pumpQueue();
}

function retryAfter(response: Response): number {
	const value = response.headers.get('Retry-After');
	if (!value) return 0;
	const seconds = Number(value);
	return Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(value) || 0;
}

async function markFetchFailure(channelId: string, response?: Response) {
	if (unsubscribedChannels.has(channelId)) return;
	const rateLimited = response?.status === 403 || response?.status === 429;
	await localDb.transaction('rw', localDb.channelSubscriptions, async () => {
		if (unsubscribedChannels.has(channelId)) return;
		const existing = await localDb.channelSubscriptions.get(channelId);
		if (unsubscribedChannels.has(channelId)) return;
		const failures = Math.min((existing?.rssFailureCount ?? 0) + 1, 8);
		const baseDelay = rateLimited ? 15 * 60 * 1000 : 5 * 60 * 1000;
		const retryAt = Math.max(
			Date.now() + Math.min(baseDelay * 2 ** (failures - 1), 24 * 60 * 60 * 1000),
			response ? retryAfter(response) : 0
		);
		if (rateLimited) setGlobalRetryAt(retryAt);
		await localDb.channelSubscriptions.put({
			channelId,
			channelName: existing?.channelName ?? 'Unknown',
			lastRSSFetch: existing?.lastRSSFetch ?? new Date(0),
			nextRSSFetch: new Date(retryAt),
			rssFailureCount: failures
		});
	});
}

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

export async function postSubscribeYTjs(
	authorId: string,
	authorName: string | undefined = undefined
) {
	if (!authorName) {
		const channel = await getChannelYTjs(authorId);
		authorName = channel.author;
	}
	resumeChannelRSS(authorId);
	await localDb.channelSubscriptions.put({
		channelId: authorId,
		channelName: authorName,
		lastRSSFetch: new Date(0)
	});
	void parseChannelRSS(authorId);
}

export async function deleteUnsubscribeYTjs(authorId: string) {
	cancelChannelRSS(authorId);
	await localDb.channelSubscriptions.where('channelId').equals(authorId).delete();
	await localDb.subscriptionFeed.where('authorId').equals(authorId).delete();
	notifyFeedUpdated();
}

export function parseChannelRSS(channelId: string): Promise<boolean> {
	const pending = pendingChannels.get(channelId);
	if (pending) return pending;
	const request = new Promise<boolean>((resolve) => {
		requestQueue.push({ channelId, resolve });
		pumpQueue();
	});
	pendingChannels.set(channelId, request);
	void request.then(() => pendingChannels.delete(channelId));
	return request;
}

async function fetchChannelRSS(channelId: string): Promise<boolean> {
	if (unsubscribedChannels.has(channelId) || globalRetryAt() > Date.now()) return false;
	const subscription = await localDb.channelSubscriptions.get(channelId);
	if (subscription?.nextRSSFetch && new Date(subscription.nextRSSFetch).getTime() > Date.now()) {
		return false;
	}
	let response: Response;
	try {
		response = await fetch(
			'https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(channelId),
			{ priority: 'low', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
		);
	} catch {
		await markFetchFailure(channelId);
		return false;
	}
	if (!response.ok) {
		await markFetchFailure(channelId, response);
		return false;
	}

	let responseText: string;
	try {
		responseText = await response.text();
	} catch {
		await markFetchFailure(channelId);
		return false;
	}
	const xmlDoc = new DOMParser().parseFromString(responseText, 'application/xml');
	if (
		xmlDoc.documentElement.localName !== 'feed' ||
		xmlDoc.getElementsByTagName('parsererror').length
	) {
		await markFetchFailure(channelId);
		return false;
	}
	const entries = Array.from(xmlDoc.getElementsByTagName('entry'));
	const channelName =
		xmlDoc.documentElement.getElementsByTagName('author')[0]?.getElementsByTagName('name')[0]
			?.textContent ||
		subscription?.channelName ||
		'Unknown';
	const videos: Video[] = [];
	for (const entry of entries) {
		const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent;
		const title = entry.getElementsByTagName('title')[0]?.textContent;
		const publishedAt = Date.parse(entry.getElementsByTagName('published')[0]?.textContent ?? '');
		if (!videoId || !title || !Number.isFinite(publishedAt)) {
			await markFetchFailure(channelId);
			return false;
		}
		const description =
			entry.getElementsByTagName('media:description')[0]?.textContent || 'No description available';
		const videoThumbnails: Thumbnail[] = Array.from(
			entry.getElementsByTagName('media:group')[0]?.getElementsByTagName('media:thumbnail') || []
		).map((thumbElement) => ({
			url: thumbElement.getAttribute('url') || '',
			width: parseInt(thumbElement.getAttribute('width') || '0'),
			height: parseInt(thumbElement.getAttribute('height') || '0')
		}));
		const viewCountText =
			entry.getElementsByTagName('media:statistics')[0]?.getAttribute('views') || '0';
		const viewCount = parseInt(viewCountText) || 0;
		videos.push({
			type: 'video',
			videoId,
			title,
			videoThumbnails,
			author: channelName,
			authorId: channelId,
			description,
			descriptionHtml: description,
			published: publishedAt / 1000,
			publishedText: relativeTimestamp(publishedAt, false),
			liveNow: false,
			premium: false,
			isUpcoming: false,
			lengthSeconds: 0,
			viewCountText: cleanNumber(viewCount),
			viewCount,
			authorUrl: '/channel/' + channelId,
			authorVerified: false
		});
	}

	if (unsubscribedChannels.has(channelId)) return false;
	let stored = false;
	await localDb.transaction(
		'rw',
		localDb.channelSubscriptions,
		localDb.subscriptionFeed,
		async () => {
			if (unsubscribedChannels.has(channelId)) return;
			if (videos.length) await localDb.subscriptionFeed.bulkPut(videos);
			await localDb.channelSubscriptions.put({
				channelId,
				channelName,
				lastRSSFetch: new Date(),
				rssFailureCount: 0
			});
			stored = true;
		}
	);
	if (!stored || unsubscribedChannels.has(channelId)) return false;
	notifyFeedUpdated();
	return true;
}

export async function clearFeedYTjs() {
	await localDb.subscriptionFeed.clear();
}

async function getStaleSubscriptions(): Promise<ChannelSubscriptions[]> {
	const channelSubscriptions = get(rawMasterKeyStore)
		? await getSubscriptionsBackend()
		: await localDb.channelSubscriptions.toArray();
	const localSubscriptions = new Map(
		(await localDb.channelSubscriptions.toArray()).map((channel) => [channel.channelId, channel])
	);
	const now = Date.now();
	const cooldownTime = get(engineCooldownYTStore) * 60 * 60 * 1000;
	const stale: ChannelSubscriptions[] = [];
	for (const channel of channelSubscriptions) {
		const local = localSubscriptions.get(channel.channelId);
		const lastFetch = new Date(local?.lastRSSFetch ?? channel.lastRSSFetch).getTime();
		const retryAt = new Date(local?.nextRSSFetch ?? 0).getTime();
		if (
			!unsubscribedChannels.has(channel.channelId) &&
			now >= retryAt &&
			now - lastFetch > cooldownTime
		) {
			stale.push({ ...channel, lastRSSFetch: new Date(lastFetch) });
		}
	}
	stale.sort((a, b) => a.lastRSSFetch.getTime() - b.lastRSSFetch.getTime());
	return stale;
}

async function refreshStaleChannels(): Promise<void> {
	if (globalRetryAt() > Date.now()) return;
	const staleChannels = await getStaleSubscriptions();
	await Promise.all(staleChannels.map((channel) => parseChannelRSS(channel.channelId)));
}

function ensureRefreshRunning(): Promise<void> {
	if (!refreshPromise) {
		refreshPromise = refreshStaleChannels()
			.catch((error) => console.error('Failed to refresh subscriptions', error))
			.finally(() => {
				refreshPromise = null;
			});
	}
	return refreshPromise;
}

export async function getFeedYTjs(maxResults: number, page: number): Promise<Feed> {
	void ensureRefreshRunning();
	const videos = await localDb.subscriptionFeed.toArray();
	videos.sort((a, b) => b.published - a.published);
	const start = (page - 1) * maxResults;
	const sliced = videos.slice(start, start + maxResults);
	if (page === 1) {
		const cullAfter = get(engineCullYTStore);
		if (videos.length > cullAfter) {
			const videoIdsToDelete = videos.slice(cullAfter).map((video) => video.videoId);
			await localDb.subscriptionFeed.where('videoId').anyOf(videoIdsToDelete).delete();
		}
	}
	return { notifications: [], videos: sliced };
}
