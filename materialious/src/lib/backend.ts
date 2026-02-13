import sodium from 'libsodium-wrappers-sumo';
import { rawSubscriptionKeyStore } from './store';

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

	const subscriptionPasswordSalt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

	const userCreateResp = await fetch('/api/user/create', {
		method: 'POST',
		body: JSON.stringify({
			username: username,
			password: {
				hash: sodium.to_base64(loginHash),
				salt: sodium.to_base64(passwordSalt)
			},
			subscriptionPasswordSalt: sodium.to_base64(subscriptionPasswordSalt)
		})
	});

	if (!userCreateResp.ok) return false;

	const subscriptionRawKey = sodium.crypto_pwhash(
		32,
		rawPassword,
		passwordSalt,
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

	rawSubscriptionKeyStore.set(sodium.to_base64(subscriptionRawKey));

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

	const subscriptionRawKey = sodium.crypto_pwhash(
		32,
		rawPassword,
		sodium.from_base64(passwordSalts.subscriptionPasswordSalt),
		sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);

	rawSubscriptionKeyStore.set(sodium.to_base64(subscriptionRawKey));

	return true;
}
