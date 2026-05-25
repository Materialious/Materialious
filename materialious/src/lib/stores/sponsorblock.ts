import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import { getPublicEnv } from '../misc';

export const sponsorBlockStore = persist(writable(true), createStorage(), 'sponsorBlock');
export const sponsorBlockUrlStore: Writable<string | null | undefined> = persist(
	writable(getPublicEnv('DEFAULT_SPONSERBLOCK_INSTANCE') || 'https://sponsor.ajay.app'),
	createStorage(),
	'sponsorBlockUrl'
);

export const sponsorBlockCategoriesStore: Writable<
	Record<string, 'automatic' | 'manual' | 'timeline' | undefined>
> = persist(writable({}), createStorage(), 'sponsorBlockCategoriesv2');

export const sponsorBlockDisplayToastStore: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'sponsorBlockDisplayToast'
);
export const sponsorBlockTimelineStore: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'sponsorBlockTimeline'
);

export const deArrowInstanceStore = persist(
	writable(getPublicEnv('DEFAULT_DEARROW_INSTANCE') || 'https://sponsor.ajay.app'),
	createStorage(),
	'deArrowInstance'
);
export const deArrowEnabledStore = persist(writable(false), createStorage(), 'deArrowEnabled');
export const deArrowTitlesOnly = persist(writable(true), createStorage(), 'deArrowTitlesOnly');
export const deArrowThumbnailInstanceStore = persist(
	writable(getPublicEnv('DEFAULT_DEARROW_THUMBNAIL_INSTANCE') || 'https://dearrow-thumb.ajay.app'),
	createStorage(),
	'deArrowThumbnailInstance'
);
