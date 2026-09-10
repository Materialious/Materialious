import { decryptWithMasterKey, encryptWithMasterKey } from './encryption';
import { backendFetch } from './request';

export async function addOrUpdateKeyValue(key: string, value: string) {
	const valueEncrypted = await encryptWithMasterKey(value);

	await backendFetch(`/api/user/keyValue/${key}`, {
		method: 'POST',
		body: JSON.stringify({
			valueCipher: valueEncrypted?.cipher,
			valueNonce: valueEncrypted?.nonce
		})
	});
}

export async function deleteKeyValue(key: string) {
	await backendFetch(`/api/user/keyValue/${key}`, {
		method: 'DELETE'
	});
}

export type KeyValue = boolean | number | string[] | string | object | undefined;

export async function getKeyValue(key: string): Promise<KeyValue | null> {
	const resp = await backendFetch(`/api/user/keyValue/${key}`, {
		method: 'GET'
	});

	if (!resp.ok) return null;

	const respJson = await resp.json();
	return (await decryptWithMasterKey(respJson.valueNonce, respJson.valueCipher)) ?? null;
}
