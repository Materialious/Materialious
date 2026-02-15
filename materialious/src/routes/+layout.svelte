<script lang="ts">
	import {
		darkModeStore,
		interfaceAmoledTheme,
		invidiousAuthStore,
		isAndroidTvStore,
		rawMasterKeyStore,
		themeColorStore
	} from '$lib/store';
	import ui from 'beercss';
	import { App } from '@capacitor/app';
	import '$lib/fetchProxy';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { setAmoledTheme, setStatusBarColor, setTheme } from '$lib/theme';

	import { pwaInfo } from 'virtual:pwa-info';
	import { onMount } from 'svelte';
	import { Capacitor } from '@capacitor/core';
	import colorTheme, { convertToHexColorCode } from '$lib/android/plugins/colorTheme';
	import { Browser } from '@capacitor/browser';
	import {
		bookmarkletLoadFromUrl,
		loadSettingsFromEnv,
		syncSettingsToBackend
	} from '$lib/externalSettings';

	let { children } = $props();

	interfaceAmoledTheme.subscribe(async () => {
		setAmoledTheme();

		await setStatusBarColor();
	});

	darkModeStore.subscribe(async () => {
		setTheme();
		setAmoledTheme();

		await setStatusBarColor();
	});

	App.addListener('backButton', async (data) => {
		if (data.canGoBack) {
			window.history.back();
		} else {
			await App.exitApp();
		}
	});

	App.addListener('appUrlOpen', (data) => {
		const url = new URL(data.url);

		// Handle youtube deeplinks
		if (url.protocol !== 'materialious-auth:') {
			let videoId = url.searchParams.get('v');
			if (!videoId) {
				videoId = url.pathname.split('/')[1];
			}

			if (videoId === 'shorts') {
				videoId = url.pathname.split('/')[2];
			}

			if (!videoId) {
				return;
			}

			goto(resolve(`/watch/[videoId]`, { videoId: videoId }));
		} else {
			// Auth response handling for Mobile
			const username = url.searchParams.get('username');
			const token = url.searchParams.get('token');

			if (username && token) {
				invidiousAuthStore.set({
					username: username,
					token: token
				});
			}
		}
	});

	onMount(async () => {
		ui();

		if (Capacitor.getPlatform() === 'android' && $themeColorStore) {
			try {
				const colorPalette = await colorTheme.getColorPalette();
				themeColorStore.set(convertToHexColorCode(colorPalette.primary));
				await ui('theme', $themeColorStore);
			} catch {
				// Continue regardless of error
			}
		}

		if (Capacitor.getPlatform() === 'android') {
			document.addEventListener('click', async (event: MouseEvent) => {
				// Handles opening links in browser for android.
				const link = (event.target as HTMLElement).closest('a');

				if (link && link.href && link.href.startsWith('http') && link.target === '_blank') {
					event.preventDefault();
					await Browser.open({ url: link.href });
				}
			});
		}

		loadSettingsFromEnv();
		// Should always be loaded after env settings
		// So user preferences overwrite instance preferences.
		bookmarkletLoadFromUrl();

		await setStatusBarColor();

		setTheme();
		setAmoledTheme();
	});

	let syncToSettingsInitialized = false;
	rawMasterKeyStore.subscribe((value) => {
		if (value === undefined || syncToSettingsInitialized) return;
		syncToSettingsInitialized = true;
		syncSettingsToBackend();
	});

	let webManifestLink = $derived(pwaInfo ? pwaInfo.webManifest.linkTag : '');
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html webManifestLink}

	{#if $isAndroidTvStore}
		<style>
			:focus {
				outline: 4px solid var(--primary);
				box-shadow: none !important;
			}
		</style>
	{:else}
		<style>
			:focus {
				outline: none !important;
				box-shadow: none !important;
			}
		</style>
	{/if}
</svelte:head>

{@render children?.()}
