import { writable } from 'svelte/store';

export type TvUpdateState = {
	status: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'installing' | 'error';
	version?: string;
	url?: string;
	progress?: number;
	message?: string;
	prompt?: boolean;
};

export const tvUpdateState = writable<TvUpdateState>({ status: 'idle' });
