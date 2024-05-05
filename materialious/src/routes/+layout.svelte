<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating } from '$app/stores';
	import { getFeed } from '$lib/Api/index';
	import type { Notification } from '$lib/Api/model';
	import Logo from '$lib/Logo.svelte';
	import MiniPlayer from '$lib/MiniPlayer.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import Search from '$lib/Search.svelte';
	import Settings from '$lib/Settings.svelte';
	import SyncParty from '$lib/SyncParty.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { bookmarkletLoadFromUrl } from '$lib/bookmarklet';
	import { App } from '@capacitor/app';
	import { Browser } from '@capacitor/browser';
	import { Capacitor } from '@capacitor/core';
	import 'beercss';
	import 'material-dynamic-colors';
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { pwaInfo } from 'virtual:pwa-info';
	import {
		activePageStore,
		authStore,
		darkModeStore,
		instanceStore,
		syncPartyPeerStore,
		themeColorStore
	} from '../store';

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

	darkModeStore.subscribe((isDark) => {
		if (isDark) {
			ui('mode', 'dark');
		} else {
			ui('mode', 'light');
		}
	});

	// Auth response handling for Mobile
	App.addListener('appUrlOpen', (data) => {
		const authUrl = new URL(data.url);
		const username = authUrl.searchParams.get('username');
		const token = authUrl.searchParams.get('token');

		if (username && token) {
			authStore.set({
				username: username,
				token: token
			});
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

	onMount(async () => {
		ui();

		bookmarkletLoadFromUrl();

		const isDark = get(darkModeStore);

		if (isDark === null) {
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
				darkModeStore.set(true);
				ui('mode', 'dark');
			} else {
				darkModeStore.set(false);
				ui('mode', 'light');
			}
		} else {
			if (isDark) {
				ui('mode', 'dark');
			} else {
				ui('mode', 'light');
			}
		}

		const themeHex = get(themeColorStore);
		if (themeHex) {
			await ui('theme', themeHex);
		}

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

	<button class="circle large transparent m l small-margin" data-ui="#menu-expanded"
		><i>menu</i></button
	>

	<Logo classes="m l" />
	<h6 class="l">Materialious</h6>

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
		<button data-ui="#sync-party" class="circle large transparent">
			<i class:primary-text={$syncPartyPeerStore}>group</i>
			<div class="tooltip bottom">{$_('layout.syncParty')}</div>
		</button>
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

<dialog class="left small" id="menu-expanded">
	<header class="fixed">
		<nav>
			<button class="transparent circle large" data-ui="#menu-expanded"><i>menu</i></button>
			<div style="width: 20%;">
				<Logo />
			</div>
			<h6>Materialious</h6>
		</nav>
	</header>

	<div class="space"></div>
	{#each pages as page}
		{#if !page.requiresAuth || isLoggedIn}
			<a
				class="row round"
				data-ui="#menu-expanded"
				href={page.href}
				class:active={currentPage === page.name.toLowerCase()}
				><i>{page.icon}</i>
				<div>{page.name}</div></a
			>
		{/if}
	{/each}
</dialog>

<main class="responsive max root">
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
