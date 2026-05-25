import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';

export const rawMasterKeyStore: Writable<string | undefined> = persist(
	writable(),
	createStorage(),
	'rawMasterKey'
);

export const watchHistoryEnabledStore: Writable<boolean> = persist(
	writable(true),
	createStorage(),
	'watchHistoryEnabled'
);

export const poTokenCacheStore: Writable<string | undefined> = writable();

export const isAndroidTvStore: Writable<boolean> = writable(false);
