import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import type z from 'zod';
import type { zFilterSchema } from '../filtering/index';

export const filterContentListStore: Writable<z.infer<typeof zFilterSchema> | undefined> = persist(
	writable(),
	createStorage(),
	'filterContentList'
);

export const filterContentUrlStore: Writable<string | undefined> = persist(
	writable(),
	createStorage(),
	'filterContentUrl'
);

export const filterContentUrlAutoUpdateStore: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'filterContentUrlAutoUpdate'
);
