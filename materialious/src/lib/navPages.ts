import { _ } from '$lib/i18n';
import { get } from 'svelte/store';
import { isYTBackend } from './misc';

export type Pages = { icon: string; href: string; name: string; requiresAuth: boolean }[];

// Must be a func do to how i18n is loaded
export function getPages(): Pages {
	return [
		{
			icon: 'home',
			href: !isYTBackend() ? '/' : '/subscriptions',
			name: get(_)('pages.home'),
			requiresAuth: false
		},
		{
			icon: 'subscriptions',
			href: '/subscriptions',
			name: get(_)('pages.subscriptions'),
			requiresAuth: true
		},
		{
			icon: 'video_library',
			href: '/playlists',
			name: get(_)('pages.playlists'),
			requiresAuth: true
		}
	];
}
