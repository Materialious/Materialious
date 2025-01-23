<script lang="ts">
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import '$lib/android/http/androidRequests';
	import colorTheme, { convertToHexColorCode } from '$lib/android/plugins/colorTheme';
	import { getFeed } from '$lib/api/index';
	import type { Notification } from '$lib/api/model';
	import { bookmarkletLoadFromUrl, loadSettingsFromEnv } from '$lib/externalSettings';
	import Logo from '$lib/Logo.svelte';
	import MiniPlayer from '$lib/MiniPlayer.svelte';
	import { setStatusBarColor } from '$lib/misc';
	import PageLoading from '$lib/PageLoading.svelte';
	import Search from '$lib/Search.svelte';
	import Settings from '$lib/Settings.svelte';
	import {
		activePageStore,
		authStore,
		darkModeStore,
		instanceStore,
		interfaceAmoledTheme,
		showWarningStore,
		syncPartyPeerStore,
		themeColorStore
	} from '$lib/store';
	import SyncParty from '$lib/SyncParty.svelte';
	import { setAmoledTheme, setTheme } from '$lib/theme';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { App } from '@capacitor/app';
	import { Browser } from '@capacitor/browser';
	import { Capacitor } from '@capacitor/core';
	import 'beercss';
	import ui from 'beercss';
	import 'material-dynamic-colors';
	import { onMount, tick } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { pwaInfo } from 'virtual:pwa-info';

	let mobileSearchShow = false;

	let currentPage: string | null = '';
	activePageStore.subscribe((page) => (currentPage = page));

	let isLoggedIn = false;
	authStore.subscribe((value) => {
		isLoggedIn = value !== null;
	});

	let notifications: Notification[] = [];

	const pages = [
		{
			icon: 'home',
			href: '/',
			name: $_('pages.home'),
			requiresAuth: false
		},
		{
			icon: 'whatshot',
			href: '/trending',
			name: $_('pages.trending'),
			requiresAuth: false
		},
		{
			icon: 'subscriptions',
			href: '/subscriptions',
			name: $_('pages.subscriptions'),
			requiresAuth: true
		},
		{
			icon: 'video_library',
			href: '/playlists',
			name: $_('pages.playlists'),
			requiresAuth: true
		},
		{
			icon: 'history',
			href: '/history',
			name: $_('pages.history'),
			requiresAuth: true
		}
	];

	interfaceAmoledTheme.subscribe(() => {
		setAmoledTheme();
	});

	darkModeStore.subscribe(async () => {
		setTheme();
		setAmoledTheme();

		await setStatusBarColor();
	});

	App.addListener('appUrlOpen', (data) => {
		const url = new URL(data.url);

		// Handle youtube deeplinks
		if (url.protocol !== 'materialious-auth:') {
			let videoId = url.searchParams.get('v');
			if (!videoId) {
				videoId = url.pathname.split('/')[1];
			}

			if (!videoId) {
				return;
			}

			goto(`/watch/${videoId}`);
		} else {
			// Auth response handling for Mobile
			const username = url.searchParams.get('username');
			const token = url.searchParams.get('token');

			if (username && token) {
				authStore.set({
					username: username,
					token: token
				});
			}
		}
	});

	async function login() {
		const path = new URL(`${get(instanceStore)}/authorize_token`);
		const searchParams = new URLSearchParams({
			scopes: ':feed,:subscriptions*,:playlists*,:history*,:notifications*'
		});
		if (Capacitor.getPlatform() === 'android') {
			searchParams.set('callback_url', 'materialious-auth://');
			path.search = searchParams.toString();
			await Browser.open({ url: path.toString() });
		} else {
			searchParams.set('callback_url', `${location.origin}/auth`);
			path.search = searchParams.toString();
			document.location.href = path.toString();
		}
	}

	function logout() {
		authStore.set(null);
		goto('/');
	}

	async function loadNotifications() {
		const feed = await getFeed(15, 1);
		notifications = feed.notifications;
	}

	let scrollPositions = new Map();
	let scrollableRoot: HTMLElement | null = null;

	beforeNavigate(({ from }) => {
		if (from?.url && scrollableRoot) {
			// Save the scroll position of the root element
			scrollPositions.set(from.url.pathname, scrollableRoot.scrollTop);
		}
	});

	// Restore the scroll position after navigating to a new page
	afterNavigate(async ({ to, type }) => {
		if (!scrollableRoot) return;

		if (to?.url && scrollPositions.has(to.url.pathname)) {
			// Check user went back
			if (type === 'popstate') {
				await tick();
				scrollableRoot.scrollTo(0, scrollPositions.get(to.url.pathname) || 0);
			} else {
				scrollPositions.delete(to.url.pathname);
			}
		} else {
			// Default behavior: scroll to top
			scrollableRoot.scrollTo(0, 0);
		}
	});

	onMount(async () => {
		ui();

		scrollableRoot = document.querySelector('.root');

		loadSettingsFromEnv();
		// Should always be loaded after env settings
		// So user preferences overwrite instance preferences.
		bookmarkletLoadFromUrl();

		let themeHex = get(themeColorStore);
		if (themeHex) {
			await ui('theme', themeHex);
		} else if (Capacitor.getPlatform() === 'android') {
			if (!themeHex) {
				try {
					const colorPalette = await colorTheme.getColorPalette();
					themeHex = convertToHexColorCode(colorPalette.primary);
					await ui('theme', themeHex);
					await setStatusBarColor();
				} catch {}
			}
		}

		setTheme();
		setAmoledTheme();

		if (isLoggedIn) {
			loadNotifications().catch(() => authStore.set(null));
		}
	});

	$: webManifestLink = pwaInfo ? pwaInfo.webManifest.linkTag : '';
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

<nav class="left m l small">
	<header></header>
	{#each pages as page}
		{#if !page.requiresAuth || isLoggedIn}
			<a href={page.href} class:active={currentPage === page.name.toLowerCase()}
				><i>{page.icon}</i>
				<div>{page.name}</div>
			</a>
		{/if}
	{/each}
</nav>

<nav class="top">
	{#if !mobileSearchShow}
		<button
			on:click={() => (mobileSearchShow = !mobileSearchShow)}
			class="transparent s circle large"
		>
			<i>search</i>
		</button>
	{/if}

	{#if Capacitor.getPlatform() === 'electron'}
		<nav class="no-space">
			<button on:click={() => window.history.back()} class="border left-round">
				<i>arrow_back</i>
			</button>
			<button on:click={() => window.history.forward()} class="border right-round">
				<i>arrow_forward</i>
			</button>
		</nav>
	{/if}

	<nav on:click={() => goto('/')} style="cursor: pointer;" class="m l">
		<Logo />
		<h6 class="l">Materialious</h6>
	</nav>

	<div class="max m l"></div>

	<div class="m l">
		<Search />
	</div>

	{#if !mobileSearchShow}
		<div class="max"></div>
	{/if}

	{#if mobileSearchShow}
		<Search on:searchCancelled={() => (mobileSearchShow = false)} />
	{:else}
		{#if !Capacitor.isNativePlatform()}
			<button data-ui="#sync-party" class="circle large transparent">
				<i class:primary-text={$syncPartyPeerStore}>group</i>
				<div class="tooltip bottom">{$_('layout.syncParty')}</div>
			</button>
		{/if}
		{#if isLoggedIn}
			<button class="circle large transparent" on:click={() => ui('#dialog-notifications')}
				><i>notifications</i>
				<div class="tooltip bottom">{$_('layout.notifications')}</div>
			</button>
		{/if}
		<button class="circle large transparent" on:click={() => ui('#dialog-settings')}>
			<i>settings</i>
			<div class="tooltip bottom">{$_('layout.settings')}</div>
		</button>

		{#if !isLoggedIn}
			<button on:click={login} class="circle large transparent">
				<i>login</i>
				<div class="tooltip bottom">{$_('layout.login')}</div>
			</button>
		{:else}
			<button on:click={logout} class="circle large transparent">
				<i>logout</i>
				<div class="tooltip bottom">{$_('layout.logout')}</div>
			</button>
		{/if}
	{/if}
</nav>

<nav class="bottom s">
	{#each pages as page}
		{#if !page.requiresAuth || isLoggedIn}
			<a class="round" href={page.href} class:active={currentPage === page.name.toLowerCase()}
				><i>{page.icon}</i>
				{#if currentPage === page.name.toLowerCase()}
					<span style="font-size: .8em;">{page.name}</span>
				{/if}
			</a>
		{/if}
	{/each}
</nav>

<Settings />

<dialog class="right" id="dialog-notifications">
	<nav>
		<h5 class="max">{$_('layout.notifications')}</h5>
		<button class="circle transparent" data-ui="#dialog-notifications"><i>close</i></button>
	</nav>
	{#if notifications.length === 0}
		<p>{$_('layout.noNewNotifications')}</p>
	{:else}
		{#each notifications as notification}
			<article class="no-padding">
				<Thumbnail video={notification}></Thumbnail>
			</article>
		{/each}
	{/if}
</dialog>

<main class="responsive max root">
	{#if Capacitor.getPlatform() === 'web' && $showWarningStore}
		<dialog class="active small" style="height: fit-content;">
			<h5>Warning</h5>
			<div>
				<p>
					{@html $_('invidiousBlockWarning', {
						values: {
							android:
								'<a href="https://github.com/Materialious/Materialious/releases/latest" target="_blank" class="link" rel="noopener noreferrer">Android</a>',
							desktop:
								'<a href="https://github.com/Materialious/Materialious/releases/latest" target="_blank" class="link" rel="noopener noreferrer">Desktop</a>'
						}
					})}
				</p>
			</div>
			<nav class="right-align no-space">
				<button class="transparent link" on:click={() => showWarningStore.set(false)}
					>Don't show again</button
				>
			</nav>
		</dialog>
	{/if}
	{#if $navigating}
		<PageLoading />
	{:else}
		<slot />
	{/if}

	<SyncParty />
	<MiniPlayer />
</main>

<style>
	nav.left a {
		font-size: 0.8em;
	}
</style>
