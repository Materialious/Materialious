import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage, ifNotWebDefault } from './storage';
import { getPublicEnv } from '../misc';

export const returnYtDislikesStore = persist(writable(false), createStorage(), 'returnYtDislikes');
export const returnYTDislikesInstanceStore: Writable<string | null | undefined> = persist(
	writable(
		ifNotWebDefault(
			getPublicEnv('DEFAULT_RETURNYTDISLIKES_INSTANCE'),
			'https://ryd-proxy.materialio.us'
		)
	),
	createStorage(),
	'returnYTDislikesInstance'
);
