import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import { ensureNoTrailingSlash, getPublicEnv } from '../misc';

export const invidiousInstanceStore: Writable<string | undefined> = persist(
	writable(
		!getPublicEnv('DEFAULT_INVIDIOUS_INSTANCE')
			? undefined
			: ensureNoTrailingSlash(getPublicEnv('DEFAULT_INVIDIOUS_INSTANCE'))
	),
	createStorage(),
	'invidiousInstance'
);

export const backendInUseStore: Writable<'ivg' | 'yt'> = persist(
	writable('ivg'),
	createStorage(),
	'backendInUse'
);

export const invidiousAuthStore: Writable<null | { username: string; token: string }> = persist(
	writable(null),
	createStorage(),
	'authToken'
);
