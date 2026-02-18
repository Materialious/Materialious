<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';

	import { navigating, page } from '$app/stores';
	import { getFeed, notificationsMarkAsRead } from '$lib/api/index';
	import type { Notification } from '$lib/api/model';
	import Logo from '$lib/components/Logo.svelte';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import Search from '$lib/components/Search.svelte';
	import Settings from '$lib/components/settings/Settings.svelte';
	import SyncParty from '$lib/components/SyncParty.svelte';
	import Thumbnail from '$lib/components/thumbnail/VideoThumbnail.svelte';
	import Player from '$lib/components/player/Player.svelte';
	import '$lib/css/global.css';
	import { getPages } from '$lib/navPages';
	import {
		invidiousAuthStore,
		invidiousInstanceStore,
		interfaceDefaultPage,
		isAndroidTvStore,
		playerState,
		playertheatreModeIsActive,
		rawMasterKeyStore,
		syncPartyPeerStore,
		themeColorStore,
		backendInUseStore
	} from '$lib/store';
	import { Capacitor } from '@capacitor/core';
	import 'beercss';
	import ui from 'beercss';
	import 'material-dynamic-colors';
	import { onMount } from 'svelte';
	import { _ } from '$lib/i18n';
	import {
		goToInvidiousLogin,
		invidiousLogout,
		isYTBackend,
		materialiousLogout,
		truncate
	} from '$lib/misc';
	import Author from '$lib/components/Author.svelte';
	import Toast from '$lib/components/Toast.svelte';
	import { isOwnBackend } from '$lib/shared';

	let { children } = $props();

	const showLogin = !isYTBackend() || isOwnBackend()?.internalAuth;

	let mobileSearchShow = $state(false);
	let notifications: Notification[] = $state([]);
	let playerIsPip: boolean = $state(false);

	let pages = $state(getPages());
	invidiousAuthStore.subscribe(() => {
		pages = getPages();
	});
	rawMasterKeyStore.subscribe(() => {
		pages = getPages();
	});
	backendInUseStore.subscribe(() => {
		pages = getPages();
	});

	page.subscribe((pageData) => {
		playerIsPip = !pageData.url.pathname.includes('/watch');
		requestAnimationFrame(() => resetScroll());
	});

	async function login() {
		if (isOwnBackend()?.internalAuth) {
			goto(resolve('/internal/login', {}));
			return;
		}

		if (!$isAndroidTvStore) {
			await goToInvidiousLogin();
		} else {
			await ui('#tv-login');
			document.getElementById('username')?.focus();
		}
	}

	async function logout() {
		await ($rawMasterKeyStore ? materialiousLogout : invidiousLogout)();
	}

	let loginError: boolean = $state(false);
	let rawUsername: string = $state('');
	let rawPassword: string = $state('');
	async function usernamePasswordLogin(event: Event) {
		event.preventDefault();

		if (!$isAndroidTvStore) return;

		loginError = false;

		const body = new FormData();
		body.append('email', rawUsername);
		body.append('password', rawPassword);
		body.append('action', 'signin');

		const response = await fetch(`${$invidiousInstanceStore}/login?type=invidious`, {
			method: 'POST',
			body: body,
			headers: {
				__redirect: 'manual',
				__custom_return: 'json-headers'
			}
		});

		if (response.ok) {
			const headers = await response.json();
			if ('set-cookie' in headers) {
				const sid = (headers['set-cookie'][0].split(';') as string[]).find((cookie) =>
					cookie.startsWith('SID=')
				);

				if (sid) {
					invidiousAuthStore.set({ username: rawUsername, token: sid });
					await ui('#tv-login');
					goto(resolve('/', {}), { replaceState: true });
					return;
				}
			}
		}

		loginError = true;
	}

	async function loadNotifications() {
		const feed = await getFeed(100, 1);
		notifications = feed.notifications;
	}

	themeColorStore.subscribe(async (hex) => {
		if (!hex) return;
		await ui('theme', hex);
	});

	function resetScroll() {
		const main = document.querySelector('main.root');
		if (main) main.scrollTop = 0;
		document.documentElement.scrollTop = 0;
		document.body.scrollTop = 0;
	}

	onMount(async () => {
		if ($invidiousAuthStore && !isYTBackend()) {
			loadNotifications().catch(() => invidiousLogout());
		}

		if ($rawMasterKeyStore) {
			fetch('/api/user/isLoggedIn', { method: 'GET', credentials: 'same-origin' })
				.then((resp) => {
					if (!resp.ok) materialiousLogout();
				})
				.catch(materialiousLogout);
		}

		resetScroll();
	});
</script>

<div>
	<nav
		class="left m l surface-container"
		class:tv-nav={$isAndroidTvStore}
		class:hide={$playertheatreModeIsActive}
	>
		<header role="presentation" style="cursor: pointer;" tabindex="-1" class="small-padding">
			<a href={resolve($interfaceDefaultPage, {})} data-sveltekit-preload-data="off">
				<Logo />
			</a>
		</header>
		{#if $isAndroidTvStore}
			<a href={resolve('/search', {})} class:active={$page.url.href.endsWith('/search')}>
				<i>search</i>
				<div>{$_('searchPlaceholder')}</div>
			</a>
		{/if}
		{#each pages as navPage (navPage)}
			<a href={resolve(navPage.href, {})} class:active={$page.url.href.endsWith(navPage.href)}
				><i>{navPage.icon}</i>
				<div>{navPage.name}</div>
			</a>
		{/each}
		{#if $isAndroidTvStore}
			<div class="divider"></div>
			<a href="#settings" onclick={() => ui('#dialog-settings')}>
				<i>settings</i>
				<div>{$_('layout.settings')}</div>
			</a>
			{#if showLogin}
				{#if (!$invidiousAuthStore && !isOwnBackend()?.internalAuth) || !$rawMasterKeyStore}
					<a onclick={login} href="#login">
						<i>login</i>
						<div>{$_('layout.login')}</div>
					</a>
				{:else}
					<a onclick={logout} href="#logout">
						<i>logout</i>
						<div>{$_('layout.logout')}</div>
					</a>
				{/if}
			{/if}
		{/if}
	</nav>
	{#if !$isAndroidTvStore}
		<nav class="top" id="top-content" class:tv-nav={$isAndroidTvStore}>
			{#if $playertheatreModeIsActive}
				<header role="presentation" style="cursor: pointer;" tabindex="-1" class="small-padding">
					<a href={resolve($interfaceDefaultPage, {})}>
						<Logo />
					</a>
				</header>
			{/if}
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
					<button onclick={() => window.history.back()} class="border">
						<i>arrow_back</i>
					</button>
					<button onclick={() => window.history.forward()} class="border">
						<i>arrow_forward</i>
					</button>
				</nav>
			{/if}

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
				<button data-ui="#sync-party" class="circle large transparent">
					<i class:primary-text={$syncPartyPeerStore}>group</i>
					<div class="tooltip bottom">{$_('layout.syncParty')}</div>
				</button>
				{#if $invidiousAuthStore && !isYTBackend()}
					<button
						class="circle large transparent"
						onclick={() => {
							ui('#dialog-notifications');
							notificationsMarkAsRead();
						}}
						><i>notifications</i>
						<div class="badge secondary">
							{#if notifications.length > 99}
								99+
							{:else}
								{notifications.length}
							{/if}
						</div>
						<div class="tooltip bottom">{$_('layout.notifications')}</div>
					</button>
				{/if}
				<button class="circle large transparent" onclick={() => ui('#dialog-settings')}>
					<i>settings</i>
					<div class="tooltip bottom">{$_('layout.settings')}</div>
				</button>

				{#if showLogin}
					{#if (!$invidiousAuthStore && !isOwnBackend()?.internalAuth) || (!$rawMasterKeyStore && isOwnBackend()?.internalAuth)}
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
			{/if}
		</nav>
	{/if}

	<nav class="bottom s">
		{#each pages as navPage (navPage)}
			<a
				class="round"
				href={resolve(navPage.href, {})}
				class:active={$page.url.href.endsWith(navPage.href)}
				data-sveltekit-preload-data="off"
				><i>{navPage.icon}</i>
				<span style="font-size: .8em;">{navPage.name}</span>
			</a>
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
			{#each notifications as notification (notification)}
				<article class="no-padding border">
					<Thumbnail video={notification} sideways={true}></Thumbnail>
				</article>
			{/each}
		{/if}
	</dialog>

	<main id="main-content" class="responsive max root" tabindex="0" role="region">
		{#if $playerState}
			<div class="grid">
				<div
					class:pip={playerIsPip}
					class:s12={!playerIsPip}
					class:m12={!playerIsPip}
					class:l12={$playertheatreModeIsActive && !playerIsPip}
					class:l9={!$playertheatreModeIsActive && !playerIsPip}
				>
					<div class="pip-info">
						{#if playerIsPip}
							<div>
								<nav>
									<h6 class="max">{truncate($playerState.data.video.title, 25)}</h6>
									<button class="border m l" onclick={() => playerState.set(undefined)}>
										<i>close</i>
									</button>
								</nav>
								<div class="space"></div>
								<nav class="s">
									<a
										class="button border"
										href={resolve(`/watch/[videoId]`, { videoId: $playerState.data.video.videoId })}
										><i>keyboard_arrow_right</i></a
									>
									<button class="border" onclick={() => playerState.set(undefined)}>
										<i>close</i>
									</button>
								</nav>
							</div>
						{/if}
						<div class="player">
							{#key $playerState.data.video.videoId}
								<Player data={$playerState.data} />
							{/key}
						</div>
					</div>
					{#if playerIsPip}
						<nav class="m l">
							<Author channel={$playerState.data.video} hideSubscribe={true} />
							<div class="max"></div>
							<a
								class="button border"
								href={resolve(`/watch/[videoId]`, { videoId: $playerState.data.video.videoId })}
								><i>keyboard_arrow_right</i></a
							>
						</nav>
					{/if}
				</div>
			</div>
		{/if}

		{#if $navigating}
			<PageLoading />
		{:else}
			{@render children?.()}
		{/if}

		<SyncParty />
		<Toast />
	</main>
</div>

<dialog class="modal" id="tv-login">
	<h5>{$_('loginRequired')}</h5>
	<div>{$_('invidiousLogin')}</div>

	<form onsubmit={usernamePasswordLogin}>
		<div class="field label border" class:invalid={loginError}>
			<input id="username" bind:value={rawUsername} name="username" type="text" />
			<label for="username">{$_('username')}</label>
		</div>
		<div class="field label border" class:invalid={loginError}>
			<input bind:value={rawPassword} name="password" type="password" />
			<label for="password">{$_('password')}</label>
		</div>

		<nav class="right-align no-space">
			<button
				class="transparent link"
				type="button"
				onclick={async () => {
					await ui('#tv-login');
				}}>{$_('cancel')}</button
			>
			<button class="transparent link" type="submit">{$_('login')}</button>
		</nav>
	</form>
</dialog>

<style>
	.tv-nav {
		min-inline-size: 0.5rem;
		padding: 0;
	}

	.pip {
		position: fixed;
		bottom: 10px;
		right: 30px;
		width: 400px;
		z-index: 99999;
		padding: 1em;
		border: 0.0625rem solid var(--outline-variant);
		background-color: var(--surface-container-low);
		color: var(--on-surface);
		border-radius: 0.75rem;
	}

	.player {
		display: flex;
		justify-content: center;
	}

	#dialog-notifications {
		width: 500px;
	}

	@media only screen and (max-width: 993px) {
		.pip {
			width: 100%;
			bottom: 100px;
			right: 0px;
		}

		#dialog-notifications {
			width: 100%;
		}

		.pip > .pip-info > .player {
			height: 80px;
			width: 150px;
		}

		.pip > .pip-info {
			display: flex;
			justify-content: space-between;
		}

		.pip h6 {
			font-size: 1em;
		}
	}
</style>
