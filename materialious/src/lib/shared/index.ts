import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { materialiousBackendStore } from '$lib/stores';
import { configBackendCache } from '$lib/stores/backend';

export type IsOwnBackend = {
	builtWithBackend: boolean;
	internalAuth: boolean;
	requireAuth: boolean;
	registrationAllowed: boolean;
	allowAnyProxy: boolean;
	captchaDisabled: boolean;
};

export function isOwnBackend(): IsOwnBackend | null {
	if (browser && get(materialiousBackendStore)) {
		const cache = get(configBackendCache);
		if (cache) return {
			...cache,
			requireAuth: false,
		};
		else return null;
	}

	if (env.PUBLIC_BUILD_WITH_BACKEND !== 'true') return null;

	return {
		builtWithBackend: true,
		internalAuth: env.PUBLIC_INTERNAL_AUTH !== 'false',
		requireAuth: env.PUBLIC_REQUIRE_AUTH !== 'false',
		registrationAllowed: env.PUBLIC_REGISTRATION_ALLOWED === 'true',
		allowAnyProxy: env.PUBLIC_DANGEROUS_ALLOW_ANY_PROXY === 'true',
		captchaDisabled: env.PUBLIC_CAPTCHA_DISABLED === 'true'
	};
}

function getAdminUsernames(): string[] {
	return (env.PUBLIC_ADMIN_USERNAMES || '').split(',').map((s) => s.trim());
}

export function isAdminUsername(username: string): boolean {
	return getAdminUsernames().includes(username);
}
