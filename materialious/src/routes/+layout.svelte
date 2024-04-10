<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { getFeed } from '$lib/Api/index';
	import Logo from '$lib/Logo.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import Search from '$lib/Search.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { bookmarkletLoadFromUrl, bookmarkletSaveToUrl } from '$lib/bookmarklet';
	import type { PlayerEvents } from '$lib/player';
	import 'beercss';
	import 'material-dynamic-colors';
	import type { DataConnection } from 'peerjs';
	import Peer from 'peerjs';
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { pwaInfo } from 'virtual:pwa-info';
	import {
		activePage,
		auth,
		darkMode,
		deArrowEnabled,
		deArrowInstance,
		deArrowThumbnailInstance,
		interfaceSearchSuggestions,
		playerAlwaysLoop,
		playerAutoPlay,
		playerAutoplayNextByDefault,
		playerDash,
		playerListenByDefault,
		playerProxyVideos,
		playerSavePlaybackPosition,
		playerTheatreModeByDefault,
		returnYTDislikesInstance,
		returnYtDislikes,
		sponsorBlock,
		sponsorBlockCategories,
		sponsorBlockUrl,
		syncPartyConnections,
		syncPartyPeer,
		themeColor
	} from '../store';

	let currentPage: string | null = '';
	activePage.subscribe((page) => (currentPage = page));

	let searchSuggestions = false;
	interfaceSearchSuggestions.subscribe((value) => (searchSuggestions = value));

	let sponsorCategoriesList: string[] = [];
	sponsorBlockCategories.subscribe((value) => (sponsorCategoriesList = value));

	let isLoggedIn = false;
	auth.subscribe((value) => {
		isLoggedIn = value !== null;
	});

	let notifications: Notification[] = [];

	let sponsorBlockInstance = get(sponsorBlockUrl);
	let returnYTInstance = get(returnYTDislikesInstance);
	let deArrowUrl = get(deArrowInstance);
	let deArrowThumbnailUrl = get(deArrowThumbnailInstance);

	const pages = [
		{
			icon: 'home',
			href: '/',
			name: 'Home',
			requiresAuth: false
		},
		{
			icon: 'whatshot',
			href: '/trending',
			name: 'Trending',
			requiresAuth: false
		},
		{
			icon: 'subscriptions',
			href: '/subscriptions',
			name: 'Subscriptions',
			requiresAuth: true
		},
		{
			icon: 'video_library',
			href: '/playlists',
			name: 'Playlists',
			requiresAuth: true
		},
		{
			icon: 'history',
			href: '/history',
			name: 'History',
			requiresAuth: true
		}
	];

	const sponsorCategories = [
		{ name: 'Sponsor', category: 'sponsor' },
		{ name: 'Unpaid/Self Promotion', category: 'selfpromo' },
		{ name: 'Interaction Reminder (Subscribe)', category: 'interaction' },
		{ name: 'Intermission/Intro Animation', category: 'intro' },
		{ name: 'Endcards/Credits', category: 'outro' },
		{ name: 'Preview/Recap/Hook', category: 'preview' },
		{ name: 'Filler Tangent/Jokes', category: 'filler' }
	];

	function changeVideoEvent(conn: DataConnection) {
		conn.on('data', (data) => {
			const events = data as PlayerEvents;
			const currentUrl = new URL(location.href);

			events.events.forEach((event) => {
				if (event.type === 'change-video' && event.videoId) {
					currentUrl.pathname = `/watch/${event.videoId}`;
					goto(currentUrl);
				}
			});
		});
	}

	async function startWatchSync() {
		const currentUrl = new URL(location.href);

		if ($syncPartyPeer) {
			$syncPartyPeer.destroy();
			syncPartyPeer.set(null);
			currentUrl.searchParams.delete('sync');
			window.history.pushState({ path: currentUrl.toString() }, '', currentUrl.toString());
			return;
		}

		const peerId = crypto.randomUUID();
		currentUrl.searchParams.set('sync', peerId);
		window.history.pushState({ path: currentUrl.toString() }, '', currentUrl.toString());

		$syncPartyPeer = new Peer(peerId);

		if ($syncPartyPeer) {
			$syncPartyPeer.on('connection', (conn) => {
				conn.on('open', () => {
					if ($page.url.pathname.startsWith('/watch')) {
						const paths = $page.url.pathname.split('/');
						if (paths.length > 2) {
							conn.send({
								events: [
									{
										type: 'change-video',
										videoId: paths[2]
									}
								]
							} as PlayerEvents);
						}
					}
					changeVideoEvent(conn);
					syncPartyConnections.set([...($syncPartyConnections || []), conn]);
				});
			});
		}
	}

	function toggleSponsor(category: string) {
		if (sponsorCategoriesList.includes(category)) {
			sponsorBlockCategories.set(sponsorCategoriesList.filter((value) => value !== category));
		} else {
			sponsorCategoriesList.push(category);
			sponsorBlockCategories.set(sponsorCategoriesList);
		}
	}

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
			scopes: ':feed,:subscriptions*,:playlists*,:history*,:notifications*',
			callback_url: `${import.meta.env.VITE_DEFAULT_FRONTEND_URL}/auth`
		}).toString();

		document.location.href = path.toString();
	}

	function logout() {
		auth.set(null);
		goto('/');
	}

	async function loadNotifications() {
		const feed = await getFeed(15, 1);
		notifications = feed.notifications;
	}

	onMount(async () => {
		ui();

		bookmarkletLoadFromUrl();

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

		if (isLoggedIn) {
			loadNotifications().catch(() => auth.set(null));
		}

		const currentUrl = new URL(location.href);
		const syncId = currentUrl.searchParams.get('sync');
		if (syncId) {
			$syncPartyPeer = new Peer(crypto.randomUUID());
			$syncPartyPeer.on('open', () => {
				if (!$syncPartyPeer) return;

				const conn = $syncPartyPeer.connect(syncId);
				syncPartyConnections.set([...($syncPartyConnections || []), conn]);

				changeVideoEvent(conn);
			});

			$syncPartyPeer.on('disconnected', () => {
				syncPartyPeer.set(null);
				syncPartyConnections.set(null);
			});
		}
	});

	onDestroy(() => {
		if ($syncPartyPeer) {
			$syncPartyPeer.destroy();
			$syncPartyPeer = null;
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
	<button class="circle large transparent s m l small-margin" data-ui="#menu-expanded"
		><i>menu</i></button
	>

	<Logo classes="m l" />
	<h6 class="m l">Materialious</h6>

	<div class="max"></div>

	<div class="m l">
		<Search />
	</div>

	<div class="max"></div>
	<a
		href="https://github.com/WardPearce/Materialious"
		target="_blank"
		rel="noopener noreferrer"
		class="button circle large transparent"
	>
		<i>code</i>
		<div class="tooltip bottom">Star us on Github!</div>
	</a>
	<button data-ui="#sync-party" class="circle large transparent">
		<i class:primary-text={$syncPartyPeer}>group</i>
		<div class="tooltip bottom">Sync party</div>
	</button>
	{#if isLoggedIn}
		<button class="circle large transparent" data-ui="#dialog-notifications"
			><i>notifications</i>
			<div class="tooltip bottom">Notifications</div>
		</button>
	{/if}
	<button class="circle large transparent" data-ui="#dialog-settings">
		<i>settings</i>
		<div class="tooltip bottom">Settings</div>
	</button>

	{#if !isLoggedIn}
		<button on:click={login} class="circle large transparent">
			<i>login</i>
			<div class="tooltip bottom">Login</div>
		</button>
	{:else}
		<button on:click={logout} class="circle large transparent">
			<i>logout</i>
			<div class="tooltip bottom">Logout</div>
		</button>
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
						bind:checked={$interfaceSearchSuggestions}
						on:click={() => interfaceSearchSuggestions.set(!$interfaceSearchSuggestions)}
					/>
					<span></span>
				</label>
			</nav>
		</div>
	</div>

	<div class="settings">
		<h6>Data preferences</h6>
		<p style="width: 240px;">
			Looking to import/export subscriptions, change password or delete account?
			<a
				href={`${import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE}/preferences`}
				target="_blank"
				rel="noopener noreferrer"
				class="link"
			>
				Go here
			</a>
			and scroll to the bottom of the page.
		</p>
	</div>

	<div class="settings">
		<h6>Player</h6>
		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Autoplay video</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={$playerAutoPlay}
						on:click={() => playerAutoPlay.set(!$playerAutoPlay)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Always loop video</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={$playerAlwaysLoop}
						on:click={() => playerAlwaysLoop.set(!$playerAlwaysLoop)}
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
						bind:checked={$playerProxyVideos}
						on:click={() => playerProxyVideos.set(!$playerProxyVideos)}
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
						bind:checked={$playerSavePlaybackPosition}
						on:click={() => playerSavePlaybackPosition.set(!$playerSavePlaybackPosition)}
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
						bind:checked={$playerListenByDefault}
						on:click={() => playerListenByDefault.set(!$playerListenByDefault)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Theatre mode by default</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={$playerTheatreModeByDefault}
						on:click={() => playerTheatreModeByDefault.set(!$playerTheatreModeByDefault)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>Autoplay next by default</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={$playerAutoplayNextByDefault}
						on:click={() => playerAutoplayNextByDefault.set(!$playerAutoplayNextByDefault)}
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
					<input
						type="checkbox"
						bind:checked={$playerDash}
						on:click={() => playerDash.set(!$playerDash)}
					/>
					<span></span>
				</label>
			</nav>
		</div>
	</div>

	<div class="settings">
		<h6>Return YT Dislikes</h6>

		<form on:submit|preventDefault={() => returnYTDislikesInstance.set(returnYTInstance)}>
			<nav>
				<div class="field label border">
					<input bind:value={returnYTInstance} name="returnyt-instance" type="text" />
					<label for="returnyt-instance">Instance URL</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<nav class="no-padding">
			<div class="max">
				<p>Enabled</p>
			</div>
			<label class="switch">
				<input
					bind:checked={$returnYtDislikes}
					on:click={() => returnYtDislikes.set(!$returnYtDislikes)}
					type="checkbox"
				/>
				<span></span>
			</label>
		</nav>
	</div>

	<div class="settings">
		<h6>Sponsorblock</h6>

		<form on:submit|preventDefault={() => sponsorBlockUrl.set(sponsorBlockInstance)}>
			<nav>
				<div class="field label border">
					<input bind:value={sponsorBlockInstance} name="sponsorblock-instance" type="text" />
					<label for="sponsorblock-instance">Instance URL</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<nav class="no-padding">
			<div class="max">
				<p>Enabled</p>
			</div>
			<label class="switch">
				<input
					bind:checked={$sponsorBlock}
					on:click={() => sponsorBlock.set(!$sponsorBlock)}
					type="checkbox"
				/>
				<span></span>
			</label>
		</nav>

		{#each sponsorCategories as sponsor}
			<div class="field middle-align no-margin">
				<nav class="no-padding">
					<div class="max">
						<p>{sponsor.name}</p>
					</div>
					<label class="switch">
						<input
							type="checkbox"
							checked={sponsorCategoriesList.includes(sponsor.category)}
							on:click={() => toggleSponsor(sponsor.category)}
						/>
						<span></span>
					</label>
				</nav>
			</div>
		{/each}
	</div>

	<div class="settings">
		<h6>DeArrow</h6>

		<form on:submit|preventDefault={() => deArrowInstance.set(deArrowUrl)}>
			<nav>
				<div class="field label border">
					<input bind:value={deArrowUrl} name="dearrow-instance" type="text" />
					<label for="dearrow-instance">Instance URL</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<form on:submit|preventDefault={() => deArrowThumbnailInstance.set(deArrowThumbnailUrl)}>
			<nav>
				<div class="field label border">
					<input bind:value={deArrowThumbnailUrl} name="dearrow-thumbnail-instance" type="text" />
					<label for="dearrow-thumbnail-instance">Thumbnail instance URL</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<nav class="no-padding">
			<div class="max">
				<p>Enabled</p>
			</div>
			<label class="switch">
				<input
					bind:checked={$deArrowEnabled}
					on:click={() => deArrowEnabled.set(!$deArrowEnabled)}
					type="checkbox"
				/>
				<span></span>
			</label>
		</nav>
	</div>

	<div class="settings">
		<h6>Bookmarklet</h6>
		<button
			class="no-margin"
			on:click={async () => await navigator.clipboard.writeText(bookmarkletSaveToUrl())}
			>Copy URL</button
		>
	</div>
</dialog>

<dialog class="right" id="dialog-notifications">
	<nav>
		<h5 class="max">Notifications</h5>
		<button class="circle transparent" data-ui="#dialog-notifications"><i>close</i></button>
	</nav>
	{#if notifications.length === 0}
		<p>No new notifications here</p>
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

	<Search />
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

<dialog id="sync-party">
	<h6>Sync party</h6>
	<p>Please note your IP will be visible to users you invite.</p>
	{#if $syncPartyPeer}
		<nav>
			<div class="field label border">
				<input
					name="sync-share"
					readonly
					value={`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}?sync=${$syncPartyPeer.id}`}
					type="text"
				/>
				<label class="active" for="sync-share">Share URL</label>
			</div>
			<button
				on:click={async () => {
					await navigator.clipboard.writeText(
						`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}?sync=${$syncPartyPeer.id}`
					);
				}}
				class="square round"
			>
				<i>content_copy</i>
			</button>
		</nav>
	{/if}
	<div class="space"></div>
	<button
		class="no-margin"
		on:click={startWatchSync}
		data-ui={`${$syncPartyPeer ? '#sync-party' : ''}`}
		>{#if $syncPartyPeer}
			End
		{:else}
			Start
		{/if} sync party
	</button>
</dialog>

<main class="responsive max root">
	{#if $navigating}
		<PageLoading />
	{:else}
		<slot />
	{/if}
</main>

<style>
	nav.left a {
		font-size: 0.8em;
	}

	.settings h6 {
		margin: 1em 0 0.3em 0;
	}

	form {
		margin: 1em 0;
	}
</style>
