import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';
import type { TitleCase } from '../letterCasing';
import type { ThemeColors } from '../theme';

export const darkModeStore: Writable<null | boolean> = persist(
	writable(null),
	createStorage(),
	'darkMode'
);
export const themeColorStore: Writable<null | string> = persist(
	writable(null),
	createStorage(),
	'themeColor'
);

export const showWarningStore = persist(writable(true), createStorage(), 'showWarning');

export const interfaceRegionStore: Writable<string> = persist(
	writable('US'),
	createStorage(),
	'interfaceRegion'
);
export const interfaceSearchSuggestionsStore = persist(
	writable(true),
	createStorage(),
	'searchSuggestions'
);
export const interfaceForceCase: Writable<TitleCase> = persist(
	writable('original'),
	createStorage(),
	'forceCase'
);
export const interfaceAutoExpandComments: Writable<boolean> = persist(
	writable(true),
	createStorage(),
	'autoExpandComments'
);
export const interfaceAutoExpandDesc: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'autoExpandDesc'
);
export const interfaceAutoExpandChapters: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'autoExpandChapters'
);
export const interfaceAmoledTheme = persist(writable(false), createStorage(), 'amoledTheme');
export const interfaceDisplayThumbnailAvatars = persist(
	writable(false),
	createStorage(),
	'disableThumbnailAvatars'
);
export const interfaceDefaultPage = persist(writable('/'), createStorage(), 'defaultPage');
export const interfaceSearchHistoryEnabled = persist(
	writable(false),
	createStorage(),
	'searchHistoryEnabled'
);
export const interfaceAllowInsecureRequests = persist(
	writable(false),
	createStorage(),
	'allowInsecureRequests'
);
export const interfaceDisableAutoUpdate = persist(
	writable(false),
	createStorage(),
	'disableAutoUpdate'
);
export const interfaceAndroidUseNativeShare = persist(
	writable(true),
	createStorage(),
	'androidUseNativeShare'
);
export const interfaceAdvancedThemingStore: Writable<ThemeColors> = persist(
	writable({}),
	createStorage(),
	'advancedTheming'
);
export const interfaceBorderRadiusStore: Writable<number> = persist(
	writable(0.5),
	createStorage(),
	'borderRadius'
);
export const interfacePreserveTranslation: Writable<boolean> = persist(
	writable(false),
	createStorage(),
	'preserveTranslation'
);

export const hideSearchStore: Writable<boolean> = writable(false);
