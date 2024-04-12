<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { getFeed } from '$lib/Api/index';
	import Logo from '$lib/Logo.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import Search from '$lib/Search.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { bookmarkletLoadFromUrl, bookmarkletSaveToUrl } from '$lib/bookmarklet';
	import { removeWindowQueryFlag, setWindowQueryFlag } from '$lib/misc';
	import type { PlayerEvents } from '$lib/player';
	import 'beercss';
	import 'material-dynamic-colors';
	import type { DataConnection } from 'peerjs';
	import Peer from 'peerjs';
	import { onDestroy, onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
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

	const sponsorCategories = [
		{ name: $_('layout.sponsors.sponsor'), category: 'sponsor' },
		{ name: $_('layout.sponsors.unpaidSelfPromotion'), category: 'selfpromo' },
		{ name: $_('layout.sponsors.interactionReminder'), category: 'interaction' },
		{ name: $_('layout.sponsors.intermissionIntroAnimation'), category: 'intro' },
		{ name: $_('layout.sponsors.credits'), category: 'outro' },
		{ name: $_('layout.sponsors.preViewRecapHook'), category: 'preview' },
		{ name: $_('layout.sponsors.tangentJokes'), category: 'filler' }
	];

	function changeVideoEvent(conn: DataConnection) {
		conn.on('data', (data) => {
			const events = data as PlayerEvents;
			const currentUrl = get(page).url;

			events.events.forEach((event) => {
				if (event.type === 'change-video' && event.videoId) {
					currentUrl.pathname = `/watch/${event.videoId}`;
					goto(currentUrl);
				}
			});
		});
	}

	async function startWatchSync() {
		if ($syncPartyPeer) {
			$syncPartyPeer.destroy();
			syncPartyPeer.set(null);
			removeWindowQueryFlag('sync');
			return;
		}

		const peerId = crypto.randomUUID();
		setWindowQueryFlag('sync', peerId);
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

		const currentUrl = get(page).url;
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
		<div class="tooltip bottom">{$_('layout.star')}</div>
	</a>
	<button data-ui="#sync-party" class="circle large transparent">
		<i class:primary-text={$syncPartyPeer}>group</i>
		<div class="tooltip bottom">{$_('layout.syncParty')}</div>
	</button>
	{#if isLoggedIn}
		<button class="circle large transparent" data-ui="#dialog-notifications"
			><i>notifications</i>
			<div class="tooltip bottom">{$_('layout.notifications')}</div>
		</button>
	{/if}
	<button class="circle large transparent" data-ui="#dialog-settings">
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
</nav>

<dialog class="right" id="dialog-settings">
	<nav>
		<h4 class="max">{$_('layout.settings')}</h4>
		<button class="circle transparent" data-ui="#dialog-settings"><i>close</i></button>
	</nav>
	<p>{$_('layout.customize')} Materialious</p>

	<div class="settings">
		<h6>{$_('layout.theme.theme')}</h6>
		<button on:click={toggleDarkMode} class="no-margin">
			{#if !$darkMode}
				<i>dark_mode</i>
				<span>{$_('layout.theme.darkMode')}</span>
			{:else}
				<i>light_mode</i>
				<span>{$_('layout.theme.lightMode')}</span>
			{/if}
		</button>
		<button>
			<i>palette</i>
			<span>{$_('layout.theme.color')}</span>
			<input on:change={setColor} type="color" />
		</button>
	</div>

	<div class="settings">
		<h6>Interface</h6>
		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>{$_('layout.searchSuggestions')}</div>
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
		<h6>{$_('layout.dataPreferences.dataPreferences')}</h6>
		<p style="width: 240px;">
			<a
				href={`${import.meta.env.VITE_DEFAULT_INVIDIOUS_INSTANCE}/preferences`}
				target="_blank"
				rel="noopener noreferrer"
				class="link"
			>
				{$_('layout.dataPreferences.content')}
			</a>
		</p>
	</div>

	<div class="settings">
		<h6>{$_('layout.player.title')}</h6>
		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>{$_('layout.player.autoPlay')}</div>
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
					<div>{$_('layout.player.alwaysLoopVideo')}</div>
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
					<div>{$_('layout.player.proxyVideos')}</div>
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
					<div>{$_('layout.player.savePlaybackPosition')}</div>
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
					<div>{$_('layout.player.listenByDefault')}</div>
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

		<div class="field no-margin m l">
			<nav class="no-padding">
				<div class="max">
					<div>{$_('layout.player.theatreModeByDefault')}</div>
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
					<div>{$_('layout.player.autoPlayNextByDefault')}</div>
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
					<div>{$_('layout.player.dash')}</div>
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
					<label for="returnyt-instance">{$_('layout.instanceUrl')}</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<nav class="no-padding">
			<div class="max">
				<p>{$_('enabled')}</p>
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
					<label for="sponsorblock-instance">{$_('layout.instanceUrl')}</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<nav class="no-padding">
			<div class="max">
				<p>{$_('enabled')}</p>
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
		<h6>{$_('layout.deArrow.title')}</h6>

		<form on:submit|preventDefault={() => deArrowInstance.set(deArrowUrl)}>
			<nav>
				<div class="field label border">
					<input bind:value={deArrowUrl} name="dearrow-instance" type="text" />
					<label for="dearrow-instance">{$_('layout.instanceUrl')}</label>
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
					<label for="dearrow-thumbnail-instance">{$_('layout.deArrow.thumbnailInstanceUrl')}</label
					>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<nav class="no-padding">
			<div class="max">
				<p>{$_('enabled')}</p>
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
		<h6>{$_('layout.bookmarklet')}</h6>
		<button
			class="no-margin"
			on:click={async () => await navigator.clipboard.writeText(bookmarkletSaveToUrl())}
			>{$_('copyUrl')}</button
		>
	</div>
</dialog>

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

	<div class="s">
		<Search />
	</div>
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
	<h6>{$_('layout.syncParty')}</h6>
	<p>{$_('layout.syncPartyWarning')}</p>
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
			{$_('layout.endSyncParty')}
		{:else}
			{$_('layout.startSyncParty')}
		{/if}
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
