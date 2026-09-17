import sodium from 'libsodium-wrappers-sumo';
import { get } from 'svelte/store';
import { authTokenStore, rawMasterKeyStore } from '$lib/store';
import { backendFetch } from './request';

export type QuickConnectStatus = 'pending' | 'awaiting' | 'completed';

export const quickConnectTtlMs = 5 * 60 * 1000;

export type QuickConnectCredentials = {
	token: string;
	masterKey: string;
	username?: string;
};

export function normalizeQuickConnectCode(code: string): string {
	return code
		.toUpperCase()
		.replace(/[^0-9A-Z]/g, '')
		.replace(/[IL]/g, '1')
		.replace(/O/g, '0');
}

export async function createQuickConnectSession(): Promise<{
	code: string;
	expires: string;
} | null> {
	const resp = await backendFetch('/api/user/quickConnect', { method: 'POST' });
	if (!resp.ok) return null;

	const data = await resp.json().catch(() => null);
	if (!data?.code) return null;

	return data;
}

export async function getQuickConnectStatus(
	code: string
): Promise<{ status: QuickConnectStatus; receiverPublicKey?: string | null } | null> {
	const resp = await backendFetch(
		`/api/user/quickConnect/${encodeURIComponent(normalizeQuickConnectCode(code))}`
	);
	if (!resp.ok) return null;

	return await resp.json().catch(() => null);
}

export async function cancelQuickConnectSession(code: string): Promise<void> {
	await backendFetch(
		`/api/user/quickConnect/${encodeURIComponent(normalizeQuickConnectCode(code))}`,
		{
			method: 'DELETE'
		}
	).catch(() => {
		// Session will expire on its own.
	});
}

export async function sendQuickConnectCredentials(
	code: string,
	receiverPublicKey: string
): Promise<boolean> {
	await sodium.ready;

	const token = get(authTokenStore);
	const rawMasterKey = get(rawMasterKeyStore);

	if (!token || !rawMasterKey) return false;

	let username: string | undefined;
	try {
		const meResp = await backendFetch('/api/user/me');
		if (meResp.ok) {
			const me = await meResp.json();
			username = me?.username;
		}
	} catch {
		// Username is optional metadata.
	}

	const payload: QuickConnectCredentials = {
		token,
		masterKey: rawMasterKey,
		username
	};

	const cipher = sodium.crypto_box_seal(
		new TextEncoder().encode(JSON.stringify(payload)),
		sodium.from_base64(receiverPublicKey)
	);

	const resp = await backendFetch(
		`/api/user/quickConnect/${encodeURIComponent(normalizeQuickConnectCode(code))}/credentials`,
		{
			method: 'POST',
			body: JSON.stringify({ cipher: sodium.to_base64(cipher) })
		}
	);

	return resp.ok;
}

export async function registerQuickConnectReceiver(code: string): Promise<{
	publicKey: Uint8Array;
	privateKey: Uint8Array;
} | null> {
	await sodium.ready;

	const keypair = sodium.crypto_box_keypair();

	const resp = await backendFetch(
		`/api/user/quickConnect/${encodeURIComponent(normalizeQuickConnectCode(code))}/receiver`,
		{
			method: 'POST',
			body: JSON.stringify({ publicKey: sodium.to_base64(keypair.publicKey) })
		}
	);

	if (!resp.ok) return null;

	return {
		publicKey: keypair.publicKey,
		privateKey: keypair.privateKey
	};
}

export async function fetchQuickConnectCredentials(code: string): Promise<string | null> {
	const resp = await backendFetch(
		`/api/user/quickConnect/${encodeURIComponent(normalizeQuickConnectCode(code))}/credentials`
	);
	if (!resp.ok) return null;

	const data = await resp.json().catch(() => null);
	return data?.cipher ?? null;
}

export async function openQuickConnectCredentials(
	cipher: string,
	publicKey: Uint8Array,
	privateKey: Uint8Array
): Promise<QuickConnectCredentials | null> {
	await sodium.ready;

	try {
		const decrypted = sodium.crypto_box_seal_open(
			sodium.from_base64(cipher),
			publicKey,
			privateKey
		);

		const payload = JSON.parse(new TextDecoder().decode(decrypted));

		if (typeof payload?.token !== 'string' || typeof payload?.masterKey !== 'string') {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

export function applyQuickConnectCredentials(credentials: QuickConnectCredentials): void {
	authTokenStore.set(credentials.token);
	rawMasterKeyStore.set(credentials.masterKey);
}
