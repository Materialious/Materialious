import { get } from 'svelte/store';
import sodium from 'libsodium-wrappers-sumo';
import { authTokenStore, rawMasterKeyStore } from '$lib/store';
import type { Solution, Challenge } from 'altcha-lib/types';
import { backendFetch } from './request';
import type { IsOwnBackend } from '$lib/shared';

export type DerivePassword = (rawPassword: string, passwordSalt: Uint8Array) => Promise<Uint8Array>;
type captchaPayload = { solution: Solution; challenge: Challenge };

export async function createUserBackend(
	username: string,
	rawPassword: string,
	captchaPayload: captchaPayload,
	derivePassword: DerivePassword
): Promise<boolean> {
	await sodium.ready;

	const passwordSalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

	const loginHash = await derivePassword(rawPassword, passwordSalt);

	const decryptionKeySalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
	const rawDecryptionKey = await deriveDecryptionKey(rawPassword, decryptionKeySalt);

	const rawDecryptionMasterKey = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
	const decryptionMasterKeyNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

	const masterKeyCipher = sodium.crypto_secretbox_easy(
		rawDecryptionMasterKey,
		decryptionMasterKeyNonce,
		rawDecryptionKey
	);

	const userCreateResp = await backendFetch('/api/user/create', {
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
		})
	});

	if (!userCreateResp.ok) return false;

	const createJson = await userCreateResp.json().catch(() => null);
	if (createJson?.token) {
		authTokenStore.set(createJson.token);
	}

	rawMasterKeyStore.set(sodium.to_base64(rawDecryptionMasterKey));

	return true;
}

export async function loginUserBackend(
	username: string,
	rawPassword: string,
	captchaPayload: captchaPayload,
	derivePassword: DerivePassword
): Promise<boolean> {
	await sodium.ready;

	const passwordSaltsResp = await backendFetch(`/api/user/${username}/public`);
	if (!passwordSaltsResp.ok) return false;

	const passwordSalts = await passwordSaltsResp.json();

	const loginHash = await derivePassword(
		rawPassword,
		sodium.from_base64(passwordSalts.passwordSalt)
	);

	const loginResp = await backendFetch('/api/user/login', {
		method: 'POST',
		body: JSON.stringify({
			username,
			passwordHash: sodium.to_base64(loginHash),
			captchaPayload
		})
	});

	if (!loginResp.ok) return false;

	const loginJson = await loginResp.json();

	const rawDecryptionKey = await deriveDecryptionKey(
		rawPassword,
		sodium.from_base64(passwordSalts.decryptionKeySalt)
	);

	const rawDecryptionMasterKey = sodium.crypto_secretbox_open_easy(
		sodium.from_base64(loginJson.masterKeyCipher),
		sodium.from_base64(loginJson.masterKeyNonce),
		rawDecryptionKey
	);

	if (loginJson.token) {
		authTokenStore.set(loginJson.token);
	}

	rawMasterKeyStore.set(sodium.to_base64(rawDecryptionMasterKey));

	return true;
}

export async function deriveDecryptionKey(
	rawPassword: string,
	salt: Uint8Array
): Promise<Uint8Array> {
	await sodium.ready;

	return sodium.crypto_pwhash(
		sodium.crypto_secretbox_KEYBYTES,
		rawPassword,
		salt,
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);
}

export async function resetPasswordBackend(
	currentPassword: string,
	newPassword: string,
	derivePassword: DerivePassword
): Promise<boolean> {
	await sodium.ready;

	const meResp = await backendFetch('/api/user/me');
	if (!meResp.ok) return false;
	const me = await meResp.json();

	const currentPasswordSalt = sodium.from_base64(me.passwordSalt);
	const currentLoginHash = await derivePassword(currentPassword, currentPasswordSalt);

	const newPasswordSalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
	const newLoginHash = await derivePassword(newPassword, newPasswordSalt);

	const newDecryptionKeySalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
	const newRawDecryptionKey = await deriveDecryptionKey(newPassword, newDecryptionKeySalt);

	const rawMasterKeyBase64 = get(rawMasterKeyStore);
	if (!rawMasterKeyBase64) return false;
	const rawDecryptionMasterKey = sodium.from_base64(rawMasterKeyBase64);

	const newNonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
	const newMasterKeyCipher = sodium.crypto_secretbox_easy(
		rawDecryptionMasterKey,
		newNonce,
		newRawDecryptionKey
	);

	const resp = await backendFetch('/api/user/passwordReset', {
		method: 'POST',
		body: JSON.stringify({
			currentPasswordHash: sodium.to_base64(currentLoginHash),
			password: {
				hash: sodium.to_base64(newLoginHash),
				salt: sodium.to_base64(newPasswordSalt)
			},
			decryptionKeySalt: sodium.to_base64(newDecryptionKeySalt),
			masterKey: {
				cipher: sodium.to_base64(newMasterKeyCipher),
				nonce: sodium.to_base64(newNonce)
			}
		})
	});

	if (!resp.ok) return false;

	// Raw master key hasn't changed, but re-set it to keep store fresh
	rawMasterKeyStore.set(rawMasterKeyBase64);

	return true;
}

export async function configBackend(): Promise<IsOwnBackend | null> {
	const resp = await backendFetch('/api/config');
	if (!resp.ok) return null;

	let configJson: IsOwnBackend | undefined
	try {
		configJson = await resp.json()
	} catch {
		// Continue regardless
	}

	if (!configJson) return null;

	return configJson
}
