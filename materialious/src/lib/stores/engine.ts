import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import type { EngineFallback } from '../api/misc';

export const engineCullYTStore: Writable<number> = persist(
	writable(500),
	createStorage(),
	'engineCullYT'
);
export const engineCooldownYTStore: Writable<number> = persist(
	writable(6),
	createStorage(),
	'engineCooldownYT'
);
export const engineMaxConcurrentChannelsStore: Writable<number> = persist(
	writable(50),
	createStorage(),
	'engineMaxConcurrentChannels'
);

export const engineFallbacksStore: Writable<EngineFallback[]> = persist(
	writable([]),
	createStorage(),
	'engineFallbacks'
);
