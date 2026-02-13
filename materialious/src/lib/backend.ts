import sodium from 'libsodium-wrappers-sumo';
import { rawSubscriptionKeyStore } from './store';
import { get } from 'svelte/store';

export async function postSubscribeBackend(authorId: string) {
	const rawSubscriptionKey = get(rawSubscriptionKeyStore);

	if (!rawSubscriptionKey) return;

	await sodium.ready;

	const rawKey = sodium.from_base64(rawSubscriptionKeyStore);

	const internalAuthorId = sodium.crypto_generichash(
		sodium.crypto_generichash_BYTES,
		authorId,
		rawKey
	);

	const textEncoder = new TextEncoder();

	const channelIdNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
	const channelIdCipher = sodium.crypto_secretbox_easy(
		textEncoder.encode(authorId),
		channelIdNonce,
		rawKey
	);

	const channelNameNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
	const channelNameCipher = sodium.crypto_secretbox_easy(
		textEncoder.encode(authorId),
		channelNameNonce,
		rawKey
	);
}

export async function createUserBackend(username: string, rawPassword: string): Promise<boolean> {
	await sodium.ready;

	const passwordSalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
	const loginHash = sodium.crypto_pwhash(
		32,
		rawPassword,
		passwordSalt,
		sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
		sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

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
			}
		})
	});

	if (!userCreateResp.ok) return false;

	rawSubscriptionKeyStore.set(sodium.to_base64(rawDecryptionMasterKey));

	return true;
}

export async function loginUserBackend(username: string, rawPassword: string): Promise<boolean> {
	await sodium.ready;

	const passwordSaltsResp = await fetch(`/api/user/${username}/public`);
	if (!passwordSaltsResp.ok) return false;

	const passwordSalts = await passwordSaltsResp.json();

	const loginHash = sodium.crypto_pwhash(
		32,
		rawPassword,
		sodium.from_base64(passwordSalts.passwordSalt),
		sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
		sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

	const loginResp = await fetch('/api/user/login', {
		method: 'POST',
		body: JSON.stringify({
			username,
			passwordHash: sodium.to_base64(loginHash)
		})
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

	rawSubscriptionKeyStore.set(sodium.to_base64(rawDecryptionMasterKey));

	return true;
}
