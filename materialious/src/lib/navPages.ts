import { _ } from '$lib/i18n';
import { get } from 'svelte/store';

// Must be a func do to how i18n is loaded
export function getPages(): { icon: string; href: string; name: string; requiresAuth: boolean }[] {
	return [
		{
			icon: 'home',
			href: '/',
			name: get(_)('pages.home'),
			requiresAuth: false
		},
		{
			icon: 'whatshot',
			href: '/trending',
			name: get(_)('pages.trending'),
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
		// Temporarily disable history page due to limitations with
		// Invidious's API
		// {
		//   icon: 'history',
		//   href: '/history',
		//   name: get(_)('pages.history'),
		//   requiresAuth: true
		// }
	];
}
