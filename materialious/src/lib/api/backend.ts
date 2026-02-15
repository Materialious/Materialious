import sodium from 'libsodium-wrappers-sumo';
import { rawMasterKeyStore } from '../store';
import { get } from 'svelte/store';
import { parseChannelRSS } from './youtubejs/subscriptions';
import { getChannelYTjs } from './youtubejs/channel';
import type { ChannelSubscriptions } from '$lib/dexie';

async function getInternalAuthorId(authorId: string, rawKey: Uint8Array): Promise<string> {
	await sodium.ready;
	return sodium.to_base64(
		sodium.crypto_generichash(sodium.crypto_generichash_BYTES, authorId, rawKey)
	);
}

async function getRawKey(): Promise<Uint8Array | undefined> {
	const rawMasterKey = get(rawMasterKeyStore);
	if (!rawMasterKey) return;

	await sodium.ready;

	return sodium.from_base64(rawMasterKey);
}

export async function getSubscriptionsBackend(): Promise<ChannelSubscriptions[]> {
	const resp = await fetch(`/api/user/subscriptions`, {
		method: 'GET',
		credentials: 'same-origin'
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

	const internalAuthorId = await getInternalAuthorId(authorId, rawKey);

	await fetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'PATCH',
		credentials: 'same-origin'
	});
}

export async function amSubscribedBackend(authorId: string): Promise<boolean> {
	const rawKey = await getRawKey();
	if (!rawKey) return false;

	const internalAuthorId = await getInternalAuthorId(authorId, rawKey);

	const resp = await fetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'GET',
		credentials: 'same-origin'
	});
	if (!resp.ok) return false;

	const respJson = await resp.json();

	return respJson.amSubscribed;
}

export async function deleteUnsubscribeBackend(authorId: string) {
	const rawKey = await getRawKey();
	if (!rawKey) return false;

	const internalAuthorId = await getInternalAuthorId(authorId, rawKey);

	await fetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'DELETE',
		credentials: 'same-origin'
	});
}

export async function postSubscribeBackend(authorId: string) {
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const internalAuthorId = await getInternalAuthorId(authorId, rawKey);

	const channel = await getChannelYTjs(authorId);

	const channelId = await encryptWithMasterKey(authorId);
	const channelName = await encryptWithMasterKey(channel.author);

	const resp = await fetch(`/api/user/subscriptions/${internalAuthorId}`, {
		method: 'POST',
		body: JSON.stringify({
			channelIdCipher: channelId?.cipher,
			channelIdNonce: channelId?.nonce,
			channelNameCipher: channelName?.cipher,
			channelNameNonce: channelName?.nonce
		}),
		credentials: 'same-origin'
	});

	if (resp.ok) parseChannelRSS(authorId);
}

export type DerivePassword = (rawPassword: string, passwordSalt: Uint8Array) => Promise<Uint8Array>;

export async function createUserBackend(
	username: string,
	rawPassword: string,
	captchaPayload: string,
	derivePassword: DerivePassword
): Promise<boolean> {
	await sodium.ready;

	const passwordSalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

	const loginHash = await derivePassword(rawPassword, passwordSalt);

	const decryptionKeySalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
	const rawDecryptionKey = sodium.crypto_pwhash(
		32,
		rawPassword,
		decryptionKeySalt,
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

	const rawDecryptionMasterKey = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
	const decryptionMasterKeyNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

	const masterKeyCipher = sodium.crypto_secretbox_easy(
		rawDecryptionMasterKey,
		decryptionMasterKeyNonce,
		rawDecryptionKey
	);

	const userCreateResp = await fetch('/api/user/create', {
		method: 'POST',
		body: JSON.stringify({
			username: username,
			password: {
				hash: sodium.to_base64(loginHash),
				salt: sodium.to_base64(passwordSalt)
			},
			decryptionKeySalt: sodium.to_base64(decryptionKeySalt),
			masterKey: {
				cipher: sodium.to_base64(masterKeyCipher),
				nonce: sodium.to_base64(decryptionMasterKeyNonce)
			},
			captchaPayload
		}),
		credentials: 'same-origin'
	});

	if (!userCreateResp.ok) return false;

	rawMasterKeyStore.set(sodium.to_base64(rawDecryptionMasterKey));

	return true;
}

export async function loginUserBackend(
	username: string,
	rawPassword: string,
	captchaPayload: string,
	derivePassword: DerivePassword
): Promise<boolean> {
	await sodium.ready;

	const passwordSaltsResp = await fetch(`/api/user/${username}/public`);
	if (!passwordSaltsResp.ok) return false;

	const passwordSalts = await passwordSaltsResp.json();

	const loginHash = await derivePassword(
		rawPassword,
		sodium.from_base64(passwordSalts.passwordSalt)
	);

	const loginResp = await fetch('/api/user/login', {
		method: 'POST',
		body: JSON.stringify({
			username,
			passwordHash: sodium.to_base64(loginHash),
			captchaPayload
		}),
		credentials: 'same-origin'
	});

	if (!loginResp.ok) return false;

	const loginJson = await loginResp.json();

	const rawDecryptionKey = sodium.crypto_pwhash(
		sodium.crypto_secretbox_KEYBYTES,
		rawPassword,
		sodium.from_base64(passwordSalts.decryptionKeySalt),
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

	const rawDecryptionMasterKey = sodium.crypto_secretbox_open_easy(
		sodium.from_base64(loginJson.masterKeyCipher),
		sodium.from_base64(loginJson.masterKeyNonce),
		rawDecryptionKey
	);

	rawMasterKeyStore.set(sodium.to_base64(rawDecryptionMasterKey));

	return true;
}

export async function addOrUpdateKeyValue(key: string, value: string) {
	const valueEncrypted = await encryptWithMasterKey(value);

	await fetch(`/api/user/keyValue/${key}`, {
		method: 'POST',
		credentials: 'same-origin',
		body: JSON.stringify({
			valueCipher: valueEncrypted?.cipher,
			valueNonce: valueEncrypted?.nonce
		})
	});
}

export async function deleteKeyValue(key: string) {
	await fetch(`/api/user/keyValue/${key}`, {
		method: 'DELETE',
		credentials: 'same-origin'
	});
}

export type KeyValue = boolean | number | string[] | string | object | undefined;

export async function getKeyValue(key: string): Promise<KeyValue | null> {
	const resp = await fetch(`/api/user/keyValue/${key}`, {
		method: 'GET',
		credentials: 'same-origin'
	});

	if (!resp.ok) return null;

	const respJson = await resp.json();
	return (await decryptWithMasterKey(respJson.valueNonce, respJson.valueCipher)) ?? null;
}

async function encryptWithMasterKey(
	text: string
): Promise<{ nonce: string; cipher: string } | undefined> {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
	const cipher = sodium.crypto_secretbox_easy(new TextEncoder().encode(text), nonce, rawKey);

	return {
		nonce: sodium.to_base64(nonce),
		cipher: sodium.to_base64(cipher)
	};
}

async function decryptWithMasterKey(nonce: string, cipher: string): Promise<string | undefined> {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	return new TextDecoder().decode(
		sodium.crypto_secretbox_open_easy(sodium.from_base64(cipher), sodium.from_base64(nonce), rawKey)
	);
}
