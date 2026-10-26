import { rawMasterKeyStore } from '#lib/store';
import sodium from 'libsodium-wrappers-sumo';
import { get } from 'svelte/store';

export async function getSecureHash(toHash: string, rawKey: Uint8Array): Promise<string> {
	await sodium.ready;
	return sodium.to_base64(
		sodium.crypto_generichash(sodium.crypto_generichash_BYTES, toHash, rawKey)
	);
}

export async function getRawKey(): Promise<Uint8Array | undefined> {
	const rawMasterKey = get(rawMasterKeyStore);
	if (!rawMasterKey) return;

	await sodium.ready;

	return sodium.from_base64(rawMasterKey);
}

export async function encryptWithMasterKey(
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

export async function decryptWithMasterKey(
	nonce: string,
	cipher: string
): Promise<string | undefined> {
	await sodium.ready;
	const rawKey = await getRawKey();
	if (!rawKey) return;

	return new TextDecoder().decode(
		sodium.crypto_secretbox_open_easy(sodium.from_base64(cipher), sodium.from_base64(nonce), rawKey)
	);
}
