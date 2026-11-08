import { Capacitor } from '@capacitor/core';
import { Nodejs } from '@capawesome/capacitor-nodejs';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { secureStorageReady } from './secureStorage';
import sodium from 'libsodium-wrappers-sumo';
import { timeout } from '#lib/utils';

const TOKEN_KEY = 'androidProxySessionToken';
const TOKEN_HEADER = 'X-Materialious-Session';

let provisionedToken: Promise<string> | undefined;

async function provisionToken(): Promise<string> {
	await sodium.ready;
	await secureStorageReady;
	let token = await SecureStorage.getItem(TOKEN_KEY);

	if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
		token = sodium.to_base64(sodium.randombytes_buf(32), sodium.base64_variants.URLSAFE_NO_PADDING);
		await SecureStorage.setItem(TOKEN_KEY, token);
	}

	let ready = false;
	while (!ready) {
		({ ready } = await Nodejs.isReady());
		if (!ready) await timeout(100);
	}

	const requestId = sodium.to_hex(sodium.randombytes_buf(16));
	const acknowledged = new Promise<void>((resolve) => {
		const listener = Nodejs.addListener('message', (event) => {
			if (event.eventName !== 'proxy-session-ready' || event.args[0] !== requestId) return;
			void listener.then((handle) => handle.remove());
			resolve();
		});
	});

	await Nodejs.send({ eventName: 'set-proxy-session', args: [token, requestId] });
	await acknowledged;
	return token;
}

export function getNativeProxyToken(): Promise<string> {
	if (Capacitor.getPlatform() !== 'android') return Promise.resolve('');
	provisionedToken ??= provisionToken().catch((error) => {
		provisionedToken = undefined;
		throw error;
	});
	return provisionedToken;
}

export { TOKEN_HEADER };
