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
	search: 'ctrl+k'
};

export const keybindStore: Writable<Keybinds> = persist(
	writable<Keybinds>({ ...defaultKeybinds }),
	createStorage(),
	'keybinds'
);
