import {
	loginInvidious,
	type InvidiousCredentials,
	type InvidiousLoginResult
} from '@materialious/shared/invidious';
import { resolve } from '$app/paths';
import { Capacitor } from '@capacitor/core';
import { isOwnBackend } from '#lib/shared';
import { getPublicEnv } from '#lib/env';
import { fetchProxied, originalFetch } from '#lib/fetchProxy';

export function supportsInvidiousPasswordLogin(): boolean {
	if (Capacitor.getPlatform() === 'electron') return !!window.electronAPI?.loginInvidious;
	if (getPublicEnv('PROXY_DISABLED') === 'true') return false;
	if (Capacitor.getPlatform() === 'android') return true;
	const backend = isOwnBackend();
	return !!backend && !backend.requireCompanion;
}

export async function loginInvidiousWithPassword(
	credentials: InvidiousCredentials
): Promise<InvidiousLoginResult> {
	if (!supportsInvidiousPasswordLogin()) return { ok: false, error: 'instance' };
	try {
		if (Capacitor.getPlatform() === 'electron') {
			return await window.electronAPI.loginInvidious(credentials);
		}
		if (Capacitor.getPlatform() === 'android') {
			return await loginInvidious(credentials, async (url, options) => {
				const headers: Record<string, string> = {
					__redirect: 'manual',
					__custom_return: 'json-response'
				};
				if (options.body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
				if (options.sid) headers.__sid_auth = options.sid;
				const response = await fetchProxied(url, {
					method: options.method,
					body: options.body,
					headers
				});
				if (!response.ok) throw new Error('Login proxy unavailable');
				const envelope = await response.json();
				return {
					status: envelope.status,
					cookies: envelope.cookies,
					data:
						options.method === 'GET' && envelope.status === 200
							? JSON.parse(envelope.body)
							: undefined
				};
			});
		}
		const response = await originalFetch(resolve('/api/invidious/login'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credentials)
		});
		if (!response.ok) return { ok: false, error: 'instance' };
		return await response.json();
	} catch {
		return { ok: false, error: 'network' };
	}
}
