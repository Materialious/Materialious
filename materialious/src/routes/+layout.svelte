<script lang="ts">
	import { getSearchSuggestions } from '$lib/Api/index';
	import Logo from '$lib/Logo.svelte';
	import 'beercss';
	import 'material-dynamic-colors';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		activePage,
		auth,
		darkMode,
		interfaceSearchSuggestions,
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

	let searchSuggestions = false;
	interfaceSearchSuggestions.subscribe((value) => (searchSuggestions = value));

	let suggestionsForSearch: string[] = [];

	let debounceTimer = 0;
	const debouncedSearch = (event: any) => {
		if (!searchSuggestions) return;

		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			if (event.target.value === '') {
				suggestionsForSearch = [];
				return;
			}
			suggestionsForSearch = (await getSearchSuggestions(event.target.value)).suggestions;
		}, 250);
	};

	let isLoggedIn = false;
	auth.subscribe((value) => {
		isLoggedIn = value !== null;
	});

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

	function login() {
		const path = new URL(`${import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE}/authorize_token`);
		path.search = new URLSearchParams({
			scopes: 'scopes=:feed,:subscriptions*,:playlists*,:history*',
			callback_url: `${import.meta.env.VITE_DEFAULT_FRONTEND_URL}/auth`,
			expire: '2629800'
		}).toString();

		document.location.href = path.toString();
	}

	function logout() {
		auth.set(null);
	}

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

		// if (isLoggedIn) {
		// 	const notifications = new EventSourcePolyfill(buildPath('auth/notifications?topics=ucid'), {
		// 		headers: { Authentication: `Bearer ${get(auth)?.token}` },
		// 		withCredentials: true
		// 	});
		// 	notifications.addEventListener('notice', (event) => console.log(event));
		// }
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
	<button class="circle large transparent s m l small-margin" data-ui="#menu-expanded"
		><i>menu</i></button
	>

	<Logo />
	<h6 class="m l">Materialious</h6>

	<div class="max"></div>
	<div class="max field round suffix prefix small no-margin m l white black-text">
		<i class="front">search</i><input
			data-ui="search-suggestions"
			type="text"
			placeholder="Search..."
			on:keyup={(target) => debouncedSearch(target)}
		/>
		{#if searchSuggestions}
			<menu
				class="no-wrap"
				style="width: 100%;"
				id="search-suggestions"
				data-ui="#search-suggestions"
			>
				{#each suggestionsForSearch as suggestion}
					<a href={`/search/${suggestion}`}>{suggestion}</a>
				{/each}
			</menu>
		{/if}
	</div>
	<div class="max"></div>
	<a
		href="https://github.com/WardPearce/Materialious"
		target="_blank"
		rel="noopener noreferrer"
		class="button circle large transparent"
	>
		<i>code</i>
	</a>
	{#if isLoggedIn}
		<button class="circle large transparent" data-ui="#dialog-notifications"
			><i>notifications</i></button
		>
	{/if}
	<button class="circle large transparent" data-ui="#dialog-settings"><i>settings</i></button>

	{#if !isLoggedIn}
		<button on:click={login} class="circle large transparent"><i>login</i></button>
	{:else}
		<button on:click={logout} class="circle large transparent"><i>logout</i></button>
	{/if}
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
		<h6>Interface</h6>
		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Search suggestions</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={searchSuggestions}
						on:click={() => interfaceSearchSuggestions.set(!searchSuggestions)}
					/>
					<span></span>
				</label>
			</nav>
		</div>
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
	{#each pages as page}
		<a
			class="row round"
			data-ui="#menu-expanded"
			href={page.href}
			class:active={currentPage === page.name.toLowerCase()}
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
