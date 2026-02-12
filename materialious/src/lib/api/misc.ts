import { get } from 'svelte/store';
import type { CommentsOptions, SearchOptions } from './model';
import { engineFallbacksStore } from '$lib/store';
import { Capacitor } from '@capacitor/core';

export function searchSetDefaults(options: SearchOptions) {
	if (typeof options.sort_by === 'undefined') {
		options.sort_by = 'relevance';
	}

	if (typeof options.type === 'undefined') {
		options.type = 'all';
	}

	if (typeof options.page === 'undefined') {
		options.page = '1';
	}
}

export function commentsSetDefaults(options: CommentsOptions) {
	if (typeof options.sort_by === 'undefined') {
		options.sort_by = 'top';
	}
}

export type EngineFallback =
	| 'ResolveUrl'
	| 'Video'
	| 'Comments'
	| 'Channel'
	| 'ChannelContent'
	| 'SearchSuggestions'
	| 'Search'
	| 'Playlist';

export function useEngineFallback(fallback: EngineFallback): boolean {
	return get(engineFallbacksStore).includes(fallback) && Capacitor.isNativePlatform();
}
