import { get, writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import type z from 'zod';
import type { zFilterSchema } from '../filtering/index';

type FilterContentList = z.infer<typeof zFilterSchema>;

function createFilterContentListStore(): Writable<FilterContentList> {
	const persisted = persist(
		writable<FilterContentList | undefined>([]),
		createStorage(),
		'filterContentList'
	);

	const { subscribe, set, update } = persisted;

	// Previous versions persisted `undefined` when no filter list existed. Normalise it so the
	// list always exists (see https://github.com/Materialious/Materialious/issues/2011).
	if (!get(persisted)) set([]);

	return {
		subscribe(run, invalidate?) {
			return subscribe((value) => run(value ?? []), invalidate);
		},
		set(value) {
			set(value);
		},
		update(fn) {
			update((value) => fn(value ?? []));
		}
	};
}

export const filterContentListStore: Writable<FilterContentList> = createFilterContentListStore();

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
