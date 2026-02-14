import * as comlink from 'comlink';
import sodium from 'libsodium-wrappers-sumo';

async function derivePassword(rawPassword: string, passwordSalt: Uint8Array): Promise<Uint8Array> {
	await sodium.ready;

	return sodium.crypto_pwhash(
		32,
		rawPassword,
		passwordSalt,
		sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
		sodium.crypto_pwhash_MEMLIMIT_SENSITIVE,
		sodium.crypto_pwhash_ALG_DEFAULT
	);
}

comlink.expose({ derivePassword });
