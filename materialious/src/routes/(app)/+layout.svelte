<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import '$lib/android/http/androidRequests';
	import colorTheme, { convertToHexColorCode } from '$lib/android/plugins/colorTheme';
	import { getFeed } from '$lib/api/index';
	import type { Notification } from '$lib/api/model';
	import Logo from '$lib/components/Logo.svelte';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import Search from '$lib/components/Search.svelte';
	import Settings from '$lib/components/Settings/Settings.svelte';
	import SyncParty from '$lib/components/SyncParty.svelte';
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import '$lib/css/global.css';
	import { bookmarkletLoadFromUrl, loadSettingsFromEnv } from '$lib/externalSettings';
	import { getPages } from '$lib/navPages';
	import {
		authStore,
		darkModeStore,
		instanceStore,
		interfaceAmoledTheme,
		interfaceDefaultPage,
		showWarningStore,
		syncPartyPeerStore,
		themeColorStore
	} from '$lib/store';
	import { setAmoledTheme, setStatusBarColor, setTheme } from '$lib/theme';
	import { App } from '@capacitor/app';
	import { Browser } from '@capacitor/browser';
	import { Capacitor } from '@capacitor/core';
	import 'beercss';
	import ui from 'beercss';
	import 'material-dynamic-colors';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import { get } from 'svelte/store';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children } = $props();

	let mobileSearchShow = $state(false);

	let isLoggedIn = $state(false);
	authStore.subscribe((value) => {
		isLoggedIn = value !== null;
	});

	let notifications: Notification[] = $state([]);

	interfaceAmoledTheme.subscribe(async () => {
		setAmoledTheme();

		await setStatusBarColor();
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

	onMount(async () => {
		ui();

		document.addEventListener('click', linkClickOverwrite);

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
				} catch {}
			}
		}

		await setStatusBarColor();

		setTheme();
		setAmoledTheme();

		if (isLoggedIn) {
			loadNotifications().catch(() => authStore.set(null));
		}
	});

	function linkClickOverwrite(event: MouseEvent) {
		// Handles opening links in browser for android.

		if (Capacitor.getPlatform() !== 'android') return;

		const link = (event.target as HTMLElement).closest('a');

		if (link && link.href && link.href.startsWith('http') && link.target === '_blank') {
			event.preventDefault();
			Browser.open({ url: link.href });
		}
	}

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

<nav class="left m l small">
	<header></header>
	{#each getPages() as navPage}
		{#if !navPage.requiresAuth || isLoggedIn}
			<a
				href={navPage.href}
				class:active={$page.url.href.endsWith(navPage.href)}
				data-sveltekit-preload-data="off"
				><i>{navPage.icon}</i>
				<div>{navPage.name}</div>
			</a>
		{/if}
	{/each}
</nav>

<nav class="top">
	{#if !mobileSearchShow}
		<button
			onclick={() => (mobileSearchShow = !mobileSearchShow)}
			class="transparent s circle large"
		>
			<i>search</i>
		</button>
	{/if}

	{#if Capacitor.getPlatform() === 'electron'}
		<nav class="no-space">
			<button onclick={() => window.history.back()} class="border left-round">
				<i>arrow_back</i>
			</button>
			<button onclick={() => window.history.forward()} class="border right-round">
				<i>arrow_forward</i>
			</button>
		</nav>
	{/if}

	<nav onclick={() => goto($interfaceDefaultPage)} style="cursor: pointer;" class="m l">
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
		<div style="width: 100%;">
			<Search on:searchCancelled={() => (mobileSearchShow = false)} />
		</div>
	{:else}
		{#if !Capacitor.isNativePlatform()}
			<button data-ui="#sync-party" class="circle large transparent">
				<i class:primary-text={$syncPartyPeerStore}>group</i>
				<div class="tooltip bottom">{$_('layout.syncParty')}</div>
			</button>
		{/if}
		{#if isLoggedIn}
			<button class="circle large transparent" onclick={() => ui('#dialog-notifications')}
				><i>notifications</i>
				<div class="tooltip bottom">{$_('layout.notifications')}</div>
			</button>
		{/if}
		<button class="circle large transparent" onclick={() => ui('#dialog-settings')}>
			<i>settings</i>
			<div class="tooltip bottom">{$_('layout.settings')}</div>
		</button>

		{#if !isLoggedIn}
			<button onclick={login} class="circle large transparent">
				<i>login</i>
				<div class="tooltip bottom">{$_('layout.login')}</div>
			</button>
		{:else}
			<button onclick={logout} class="circle large transparent">
				<i>logout</i>
				<div class="tooltip bottom">{$_('layout.logout')}</div>
			</button>
		{/if}
	{/if}
</nav>

<nav class="bottom s">
	{#each getPages() as navPage}
		{#if !navPage.requiresAuth || isLoggedIn}
			<a
				class="round"
				href={navPage.href}
				class:active={$page.url.href.endsWith(navPage.href)}
				data-sveltekit-preload-data="off"
				><i>{navPage.icon}</i>
				{#if $page.url.href.endsWith(navPage.href)}
					<span style="font-size: .8em;">{navPage.name}</span>
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
								'<a href="https://github.com/Materialious/Materialious?tab=readme-ov-file#android" target="_blank" class="link" rel="noopener noreferrer">Android</a>',
							desktop:
								'<a href="https://github.com/Materialious/Materialious?tab=readme-ov-file#desktop-windowsmacoslinux" target="_blank" class="link" rel="noopener noreferrer">Desktop</a>'
						}
					})}
				</p>
			</div>
			<nav class="right-align no-space">
				<button class="transparent link" onclick={() => showWarningStore.set(false)}
					>Don't show again</button
				>
			</nav>
		</dialog>
	{/if}
	{#if $navigating}
		<PageLoading />
	{:else}
		{@render children?.()}
	{/if}

	<SyncParty />
</main>

<style>
	nav.left a {
		font-size: 0.8em;
	}
</style>
