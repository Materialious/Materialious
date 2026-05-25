import { writable, type Writable } from 'svelte/store';
import { persist } from '@macfja/svelte-persistent-store';
import { createStorage } from './storage';

export interface Keybinds {
	togglePlay: string;
	skipSponsor: string;
	toggleSubtitles: string;
	toggleFullscreen: string;
	speedDown: string;
	speedUp: string;
	frameBack: string;
	frameForward: string;
	seekBack: string;
	seekForward: string;
	search: string;
	pageBack: string;
	pageForward: string;
	closePlayer: string;
	tab1: string;
	tab2: string;
	tab3: string;
	tab4: string;
}

export const defaultKeybinds: Keybinds = {
	togglePlay: 'space',
	skipSponsor: 'enter',
	toggleSubtitles: 'c',
	toggleFullscreen: 'f',
	speedDown: 'shift+left',
	speedUp: 'shift+right',
	frameBack: ',',
	frameForward: '.',
	seekBack: 'left',
	seekForward: 'right',
	search: 'ctrl+k',
	pageBack: 'ctrl+left',
	pageForward: 'ctrl+right',
	closePlayer: 'esc',
	tab1: 'ctrl+1',
	tab2: 'ctrl+2',
	tab3: 'ctrl+3',
	tab4: 'ctrl+4'
};

function createKeybindStore(): Writable<Keybinds> {
	const store = writable<Keybinds>({ ...defaultKeybinds });
	const persisted = persist(store, createStorage(), 'keybinds');

	const { subscribe, set, update } = persisted;

	return {
		subscribe(run, invalidate?) {
			const unsub = subscribe((value) => {
				run({ ...defaultKeybinds, ...(value ?? {}) });
			}, invalidate);
			return unsub;
		},
		set(value) {
			set(value);
		},
		update(fn) {
			update((value) => fn({ ...defaultKeybinds, ...(value ?? {}) }));
		}
	};
}

export const keybindStore: Writable<Keybinds> = createKeybindStore();
