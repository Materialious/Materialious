import sodium from 'libsodium-wrappers-sumo';
import { rawMasterKeyStore } from '$lib/store';
import type { Solution, Challenge } from 'altcha-lib/types';

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
	captchaPayload: captchaPayload,
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
