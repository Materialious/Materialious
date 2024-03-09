<script lang="ts">
	import Logo from '$lib/Logo.svelte';
	import 'beercss';
	import 'material-dynamic-colors';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		activePage,
		darkMode,
		playerAlwaysLoop,
		playerAutoPlay,
		playerDash,
		playerListenByDefault,
		playerProxyVideos,
		playerSavePlaybackPosition,
		themeColor
	} from '../store';

	let currentPage: string | null = '';
	activePage.subscribe((page) => (currentPage = page));

	let autoplay = false;
	let alwaysLoop = false;
	let proxyVideos = false;
	let savePlayerPackPos = false;
	let dash = false;
	let listenByDefault = false;

	playerAutoPlay.subscribe((value) => (autoplay = value));
	playerAlwaysLoop.subscribe((value) => (alwaysLoop = value));
	playerProxyVideos.subscribe((value) => (proxyVideos = value));
	playerSavePlaybackPosition.subscribe((value) => (savePlayerPackPos = value));
	playerDash.subscribe((value) => (dash = value));
	playerListenByDefault.subscribe((value) => (listenByDefault = value));

	const pages = [
		{
			icon: 'home',
			href: '/',
			name: 'Home'
		},
		{
			icon: 'whatshot',
			href: '/trending',
			name: 'Trending'
		},
		{
			icon: 'subscriptions',
			href: '/subscriptions',
			name: 'Subscriptions'
		},
		{
			icon: 'video_library',
			href: '/playlists',
			name: 'Playlists'
		},
		{
			icon: 'history',
			href: '/history',
			name: 'History'
		}
	];

	async function setColor(color: any) {
		const target = color.target;
		const hex = (target as { value: string }).value;
		await ui('theme', hex);
		themeColor.set(hex);
	}

	function toggleDarkMode() {
		const isDark = get(darkMode);

		if (isDark) {
			ui('mode', 'light');
			darkMode.set(false);
		} else {
			ui('mode', 'dark');
			darkMode.set(true);
		}
	}

	darkMode.subscribe((isDark) => {
		if (isDark) {
			ui('mode', 'dark');
		} else {
			ui('mode', 'light');
		}
	});

	onMount(async () => {
		const isDark = get(darkMode);

		if (isDark === null) {
			if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
				darkMode.set(true);
				ui('mode', 'dark');
			} else {
				darkMode.set(false);
				ui('mode', 'light');
			}
		} else {
			if (isDark) {
				ui('mode', 'dark');
			} else {
				ui('mode', 'light');
			}
		}

		const themeHex = get(themeColor);
		if (themeHex) {
			await ui('theme', themeHex);
		}
	});
</script>

<nav class="left m l small">
	<header></header>
	{#each pages as page}
		<a href={page.href} class:active={currentPage === page.name.toLowerCase()}
			><i>{page.icon}</i>
			<div>{page.name}</div>
		</a>
	{/each}
</nav>

<nav class="top">
	<button class="circle large transparent s m l small-margin" data-ui="#dialog-expanded"
		><i>menu</i></button
	>

	<Logo />
	<h6 class="m l">Materialious</h6>

	<div class="max"></div>
	<div class="max field round suffix prefix small no-margin m l white black-text">
		<i class="front">search</i><input type="text" placeholder="Search..." />
	</div>
	<div class="max"></div>
	<button class="circle large transparent" data-ui="#dialog-notifications"
		><i>notifications</i></button
	>
	<button class="circle large transparent" data-ui="#dialog-settings"><i>settings</i></button>
	<button class="circle large transparent"><i>login</i></button>
</nav>

<dialog class="right" id="dialog-settings">
	<nav>
		<h4 class="max">Settings</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>
	<p>Customize Materialious</p>

	<div class="settings">
		<h6>Theme</h6>
		<button on:click={toggleDarkMode} class="no-margin">
			{#if !$darkMode}
				<i>dark_mode</i>
				<span>Dark mode</span>
			{:else}
				<i>light_mode</i>
				<span>Light mode</span>
			{/if}
		</button>
		<button>
			<i>palette</i>
			<span>Color</span>
			<input on:change={setColor} type="color" />
		</button>
	</div>

	<div class="settings">
		<h6>Player</h6>
		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Autoplay</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={autoplay}
						on:click={() => playerAutoPlay.set(!autoplay)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Always loop</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={alwaysLoop}
						on:click={() => playerAlwaysLoop.set(!alwaysLoop)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Proxy videos</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={proxyVideos}
						on:click={() => playerProxyVideos.set(!proxyVideos)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Save playback position</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={savePlayerPackPos}
						on:click={() => playerSavePlaybackPosition.set(!savePlayerPackPos)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Listen by default</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={listenByDefault}
						on:click={() => playerListenByDefault.set(!listenByDefault)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Dash</div>
				</div>
				<label class="switch">
					<input type="checkbox" bind:checked={dash} on:click={() => playerDash.set(!dash)} />
					<span></span>
				</label>
			</nav>
		</div>
	</div>
</dialog>

<dialog class="right" id="dialog-notifications">
	<nav>
		<h5 class="max">Notifications</h5>
		<button class="circle transparent" data-ui="#dialog-notifications"><i>close</i></button>
	</nav>
	<p>No new notifications here</p>
</dialog>

<dialog class="left small" id="dialog-expanded">
	<header class="fixed">
		<nav>
			<button class="transparent circle large" data-ui="#dialog-expanded"><i>menu</i></button>
			<div style="width: 20%;">
				<Logo />
			</div>
			<h6>Materialious</h6>
		</nav>
	</header>
	{#each pages as page}
		<a class="row round" data-ui="#dialog-expanded" href={page.href}
			><i>{page.icon}</i>
			<div>{page.name}</div></a
		>
	{/each}
</dialog>

<main class="responsive max">
	<slot />
</main>

<style>
	nav.left a {
		font-size: 0.8em;
	}

	.settings h6 {
		margin: 1em 0 0.3em 0;
	}
</style>
