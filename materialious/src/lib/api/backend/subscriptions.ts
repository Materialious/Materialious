import { parseChannelRSS } from '$lib/api/youtubejs/subscriptions';
import { getChannelYTjs } from '$lib/api/youtubejs/channel';
import type { ChannelSubscriptions } from '$lib/dexie';
import { decryptWithMasterKey, encryptWithMasterKey, getRawKey, getSecureHash } from './encryption';
import { backendFetch } from './request';

export async function getSubscriptionsBackend(): Promise<ChannelSubscriptions[]> {
	const resp = await backendFetch(`/api/user/subscriptions`, {
		method: 'GET'
	});

	if (!resp.ok) return [];

	const subscriptions: ChannelSubscriptions[] = [];

	const respJson = await resp.json();

	for (const sub of respJson.subscriptions) {
		subscriptions.push({
			channelName: (await decryptWithMasterKey(sub.channelNameNonce, sub.channelNameCipher)) ?? '',
			channelId: (await decryptWithMasterKey(sub.channelIdNonce, sub.channelIdCipher)) ?? '',
			lastRSSFetch: new Date(sub.lastRSSFetch)
		});
	}

	return subscriptions;
}

export async function updateRSSLastUpdated(authorId: string) {
	const rawKey = await getRawKey();
	if (!rawKey) return false;

	const internalAuthorId = await getSecureHash(authorId, rawKey);

	await backendFetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'PATCH'
	});
}

export async function amSubscribedBackend(authorId: string): Promise<boolean> {
	const rawKey = await getRawKey();
	if (!rawKey) return false;

	const internalAuthorId = await getSecureHash(authorId, rawKey);

	const resp = await backendFetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'GET'
	});
	if (!resp.ok) return false;

	const respJson = await resp.json();

	return respJson.amSubscribed;
}

export async function deleteUnsubscribeBackend(authorId: string) {
	const rawKey = await getRawKey();
	if (!rawKey) return false;

	const internalAuthorId = await getSecureHash(authorId, rawKey);

	await backendFetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'DELETE'
	});
}

export async function postSubscribeBackend(
	authorId: string,
	authorName: string | undefined = undefined
) {
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const internalAuthorId = await getSecureHash(authorId, rawKey);

	if (!authorName) {
		const channel = await getChannelYTjs(authorId);
		authorName = channel.author;
	}

	const channelId = await encryptWithMasterKey(authorId);
	const channelName = await encryptWithMasterKey(authorName);

	const resp = await backendFetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'POST',
		body: JSON.stringify({
			channelIdCipher: channelId?.cipher,
			channelIdNonce: channelId?.nonce,
			channelNameCipher: channelName?.cipher,
			channelNameNonce: channelName?.nonce
		})
	});

	if (resp.ok) parseChannelRSS(authorId);
}
