import {
	PUBLIC_BUILD_WITH_BACKEND,
	PUBLIC_INTERNAL_AUTH,
	PUBLIC_REQUIRE_AUTH,
	PUBLIC_REGISTRATION_ALLOWED,
	PUBLIC_DANGEROUS_ALLOW_ANY_PROXY,
	PUBLIC_CAPTCHA_DISABLED,
	PUBLIC_QUICK_CONNECT,
	PUBLIC_ADMIN_USERNAMES
} from '$app/env/public';

import { browser } from '$app/env';
import { get } from 'svelte/store';
import { materialiousBackendStore } from '#lib/stores/index';
import { configBackendCache } from '#lib/stores/backend';

export type IsOwnBackend = {
	builtWithBackend: boolean;
	internalAuth: boolean;
	requireAuth: boolean;
	registrationAllowed: boolean;
	allowAnyProxy: boolean;
	captchaDisabled: boolean;
	quickConnect: boolean;
};

export function isOwnBackend(): IsOwnBackend | null {
	if (browser && get(materialiousBackendStore)) {
		const cache = get(configBackendCache);
		if (cache)
			return {
				...cache,
				requireAuth: false
			};
		else return null;
	}

	if (PUBLIC_BUILD_WITH_BACKEND !== 'true') return null;

	return {
		builtWithBackend: true,
		internalAuth: PUBLIC_INTERNAL_AUTH !== 'false',
		requireAuth: PUBLIC_REQUIRE_AUTH !== 'false',
		registrationAllowed: PUBLIC_REGISTRATION_ALLOWED === 'true',
		allowAnyProxy: PUBLIC_DANGEROUS_ALLOW_ANY_PROXY === 'true',
		captchaDisabled: PUBLIC_CAPTCHA_DISABLED === 'true',
		quickConnect: PUBLIC_QUICK_CONNECT !== 'false'
	};
}

function getAdminUsernames(): string[] {
	return (PUBLIC_ADMIN_USERNAMES || '').split(',').map((s) => s.trim());
}

export function isAdminUsername(username: string): boolean {
	return getAdminUsernames().includes(username);
}
