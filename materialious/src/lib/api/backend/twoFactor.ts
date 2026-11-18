import sodium from 'libsodium-wrappers-sumo';
import { backendFetch } from './request';
import type { DerivePassword } from './index';

export type TwoFactorStatus = {
	configured: boolean;
	verified: boolean;
	secret?: string;
	uri?: string;
};

async function readResponse(response: Response) {
	if (!response.ok) throw new Error('Two-factor request failed');
	return response.json();
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
	return readResponse(await backendFetch('/api/user/2fa'));
}

export async function cancelTwoFactorSetup(): Promise<TwoFactorStatus> {
	const response = await backendFetch('/api/user/2fa', { method: 'DELETE' });
	if (!response.ok) throw new Error('Two-factor setup cancellation failed');
	return { configured: false, verified: false };
}

export async function changeTwoFactor(
	method: 'POST' | 'DELETE',
	password: string,
	derivePassword: DerivePassword,
	twoFactorToken?: string
): Promise<TwoFactorStatus> {
	await sodium.ready;
	const me = await readResponse(await backendFetch('/api/user/me'));
	const hash = await derivePassword(password, sodium.from_base64(me.passwordSalt));
	const response = await backendFetch('/api/user/2fa', {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ currentPasswordHash: sodium.to_base64(hash), twoFactorToken })
	});
	if (!response.ok) throw new Error('Two-factor request failed');
	if (method === 'DELETE') return { configured: false, verified: false };
	return { ...(await response.json()), configured: true, verified: false };
}

export async function confirmTwoFactor(token: string): Promise<void> {
	await readResponse(
		await backendFetch('/api/user/2fa/verify', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token })
		})
	);
}
