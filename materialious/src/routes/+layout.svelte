<script lang="ts">
	import { goto } from '$app/navigation';
	import { navigating, page } from '$app/stores';
	import { getFeed } from '$lib/Api/index';
	import type { Notification } from '$lib/Api/model';
	import Logo from '$lib/Logo.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import Search from '$lib/Search.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { bookmarkletLoadFromUrl, bookmarkletSaveToUrl } from '$lib/bookmarklet';
	import { peerJsOptions, removeWindowQueryFlag, setWindowQueryFlag } from '$lib/misc';
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
		activePageStore,
		authStore,
		darkModeStore,
		deArrowEnabledStore,
		deArrowInstanceStore,
		deArrowThumbnailInstanceStore,
		interfacePreviewVideoOnHoverStore,
		interfaceSearchSuggestionsStore,
		playerAlwaysLoopStore,
		playerAutoPlayStore,
		playerAutoplayNextByDefaultStore,
		playerDashStore,
		playerListenByDefaultStore,
		playerProxyVideosStore,
		playerSavePlaybackPositionStore,
		playerTheatreModeByDefaultStore,
		returnYTDislikesInstanceStore,
		returnYtDislikesStore,
		sponsorBlockCategoriesStore,
		sponsorBlockStore,
		sponsorBlockUrlStore,
		syncPartyConnectionsStore,
		syncPartyPeerStore,
		synciousInstanceStore,
		synciousStore,
		themeColorStore
	} from '../store';

	let mobileSearchShow = false;

	let currentPage: string | null = '';
	activePageStore.subscribe((page) => (currentPage = page));

	let sponsorCategoriesList: string[] = [];
	sponsorBlockCategoriesStore.subscribe((value) => (sponsorCategoriesList = value));

	let isLoggedIn = false;
	authStore.subscribe((value) => {
		isLoggedIn = value !== null;
	});

	let notifications: Notification[] = [];

	let sponsorBlockInstance = get(sponsorBlockUrlStore);
	let synciousInstance = get(synciousInstanceStore);
	let returnYTInstance = get(returnYTDislikesInstanceStore);
	let deArrowUrl = get(deArrowInstanceStore);
	let deArrowThumbnailUrl = get(deArrowThumbnailInstanceStore);

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
		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.destroy();
			syncPartyPeerStore.set(null);
			removeWindowQueryFlag('sync');
			return;
		}

		const peerId = crypto.randomUUID();
		setWindowQueryFlag('sync', peerId);
		$syncPartyPeerStore = new Peer(peerId, peerJsOptions());

		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.on('connection', (conn) => {
				conn.on('open', () => {
					ui('#sync-party-connection-join');

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
					syncPartyConnectionsStore.set([...($syncPartyConnectionsStore || []), conn]);
				});

				conn.on('close', () => {
					ui('#sync-party-connection-left');
				});
			});
		}
	}

	function toggleSponsor(category: string) {
		if (sponsorCategoriesList.includes(category)) {
			sponsorBlockCategoriesStore.set(sponsorCategoriesList.filter((value) => value !== category));
		} else {
			sponsorCategoriesList.push(category);
			sponsorBlockCategoriesStore.set(sponsorCategoriesList);
		}
	}

	async function setColor(color: any) {
		const target = color.target;
		const hex = (target as { value: string }).value;
		await ui('theme', hex);
		themeColorStore.set(hex);
	}

	function toggleDarkMode() {
		const isDark = get(darkModeStore);

		if (isDark) {
			ui('mode', 'light');
			darkModeStore.set(false);
		} else {
			ui('mode', 'dark');
			darkModeStore.set(true);
		}
	}

	darkModeStore.subscribe((isDark) => {
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

		const currentUrl = get(page).url;
		const syncId = currentUrl.searchParams.get('sync');
		if (syncId) {
			$syncPartyPeerStore = new Peer(crypto.randomUUID(), peerJsOptions());
			$syncPartyPeerStore.on('open', () => {
				if (!$syncPartyPeerStore) return;

				const conn = $syncPartyPeerStore.connect(syncId);
				syncPartyConnectionsStore.set([...($syncPartyConnectionsStore || []), conn]);

				changeVideoEvent(conn);
			});

			$syncPartyPeerStore.on('disconnected', () => {
				syncPartyPeerStore.set(null);
				syncPartyConnectionsStore.set(null);
			});
		}
	});

	onDestroy(() => {
		if ($syncPartyPeerStore) {
			$syncPartyPeerStore.destroy();
			$syncPartyPeerStore = null;
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
	<h6 class="m l">Materialious</h6>

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
		<button data-ui="#sync-party" class="m l circle large transparent">
			<i class:primary-text={$syncPartyPeerStore}>group</i>
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
	{/if}
</nav>

<nav class="bottom s">
	{#each pages as page}
		{#if !page.requiresAuth || isLoggedIn}
			<a class="round" href={page.href} class:active={currentPage === page.name.toLowerCase()}
				><i>{page.icon}</i>
				<div class="tooltip top">{page.name}</div>
			</a>
		{/if}
	{/each}
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
			{#if !$darkModeStore}
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
						bind:checked={$interfaceSearchSuggestionsStore}
						on:click={() => interfaceSearchSuggestionsStore.set(!$interfaceSearchSuggestionsStore)}
					/>
					<span></span>
				</label>
			</nav>
		</div>

		<div class="field no-margin">
			<nav class="no-padding">
				<div class="max">
					<div>{$_('layout.previewVideoOnHover')}</div>
				</div>
				<label class="switch">
					<input
						type="checkbox"
						bind:checked={$interfacePreviewVideoOnHoverStore}
						on:click={() =>
							interfacePreviewVideoOnHoverStore.set(!$interfacePreviewVideoOnHoverStore)}
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
						bind:checked={$playerAutoPlayStore}
						on:click={() => playerAutoPlayStore.set(!$playerAutoPlayStore)}
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
						bind:checked={$playerAlwaysLoopStore}
						on:click={() => playerAlwaysLoopStore.set(!$playerAlwaysLoopStore)}
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
						bind:checked={$playerProxyVideosStore}
						on:click={() => playerProxyVideosStore.set(!$playerProxyVideosStore)}
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
						bind:checked={$playerSavePlaybackPositionStore}
						on:click={() => playerSavePlaybackPositionStore.set(!$playerSavePlaybackPositionStore)}
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
						bind:checked={$playerListenByDefaultStore}
						on:click={() => playerListenByDefaultStore.set(!$playerListenByDefaultStore)}
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
						bind:checked={$playerTheatreModeByDefaultStore}
						on:click={() => playerTheatreModeByDefaultStore.set(!$playerTheatreModeByDefaultStore)}
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
						bind:checked={$playerAutoplayNextByDefaultStore}
						on:click={() =>
							playerAutoplayNextByDefaultStore.set(!$playerAutoplayNextByDefaultStore)}
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
						bind:checked={$playerDashStore}
						on:click={() => playerDashStore.set(!$playerDashStore)}
					/>
					<span></span>
				</label>
			</nav>
		</div>
	</div>

	<div class="settings">
		<h6>Return YT Dislikes</h6>

		<form on:submit|preventDefault={() => returnYTDislikesInstanceStore.set(returnYTInstance)}>
			<nav>
				<div class="field label border max">
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
					bind:checked={$returnYtDislikesStore}
					on:click={() => returnYtDislikesStore.set(!$returnYtDislikesStore)}
					type="checkbox"
				/>
				<span></span>
			</label>
		</nav>
	</div>

	<div class="settings">
		<h6>Syncious</h6>

		<form on:submit|preventDefault={() => synciousInstanceStore.set(synciousInstance)}>
			<nav>
				<div class="field label border max">
					<input bind:value={synciousInstance} name="syncious-instance" type="text" />
					<label for="syncious-instance">{$_('layout.instanceUrl')}</label>
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
					bind:checked={$synciousStore}
					on:click={() => synciousStore.set(!$synciousStore)}
					type="checkbox"
				/>
				<span></span>
			</label>
		</nav>
	</div>

	<div class="settings">
		<h6>Sponsorblock</h6>

		<form on:submit|preventDefault={() => sponsorBlockUrlStore.set(sponsorBlockInstance)}>
			<nav>
				<div class="field label border max">
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
					bind:checked={$sponsorBlockStore}
					on:click={() => sponsorBlockStore.set(!$sponsorBlockStore)}
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

		<form on:submit|preventDefault={() => deArrowInstanceStore.set(deArrowUrl)}>
			<nav>
				<div class="field label border max">
					<input bind:value={deArrowUrl} name="dearrow-instance" type="text" />
					<label for="dearrow-instance">{$_('layout.instanceUrl')}</label>
				</div>
				<button class="square round">
					<i>done</i>
				</button>
			</nav>
		</form>

		<form on:submit|preventDefault={() => deArrowThumbnailInstanceStore.set(deArrowThumbnailUrl)}>
			<nav>
				<div class="field label border max">
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
					bind:checked={$deArrowEnabledStore}
					on:click={() => deArrowEnabledStore.set(!$deArrowEnabledStore)}
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
	{#if $syncPartyPeerStore}
		<nav>
			<div class="field label border max">
				<input
					name="sync-share"
					readonly
					value={`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}?sync=${$syncPartyPeerStore.id}`}
					type="text"
				/>
				<label class="active" for="sync-share">Share URL</label>
			</div>
			<button
				on:click={async () => {
					await navigator.clipboard.writeText(
						`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}?sync=${$syncPartyPeerStore.id}`
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
		data-ui={`${$syncPartyPeerStore ? '#sync-party' : ''}`}
		>{#if $syncPartyPeerStore}
			{$_('layout.endSyncParty')}
		{:else}
			{$_('layout.startSyncParty')}
		{/if}
	</button>
</dialog>

<div class="snackbar" id="sync-party-connection-join">
	<i>person_add</i>
	<span>{$_('syncParty.userJoined')}</span>
</div>

<div class="snackbar" id="sync-party-connection-left">
	<i>person_remove</i>
	<span>{$_('syncParty.userLeft')}</span>
</div>

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

	@media screen and (max-width: 650px) {
		dialog.right {
			width: 100%;
		}
	}
</style>
