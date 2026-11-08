<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { _ } from '#lib/i18n/index';
	import { invidiousAuthStore, invidiousInstanceStore } from '#lib/store';
	import { isMaterialiousAccountActive } from '#lib/backend';
	import { addOrUpdateKeyValue } from '#lib/api/backend/keyvalue';
	import androidTv from '#lib/android/plugins/androidTv';
	import {
		TV_LOGIN_PORT,
		TV_LOGIN_TTL_SECONDS,
		addTvLoginListeners,
		generateLoginCode,
		generateLoginSecret,
		startTvLoginSession,
		stopTvLoginSession
	} from '#lib/tvQrLogin';
	import { renderSVG } from 'uqr';
	import { isAndroidTv } from '#lib/utils';
	import { onDestroy, onMount, tick } from 'svelte';

	let loginError: boolean = $state(false);
	let rawUsername: string = $state('');
	let rawPassword: string = $state('');

	// QR login state. The password form stays as the fallback throughout.
	let qrEnabled: boolean = $state(isAndroidTv());
	let showQr: boolean = $state(isAndroidTv());
	let addresses: string[] = $state([]);
	let code: string = $state('');
	let secondsLeft: number = $state(0);
	let loginStatus: 'waiting' | 'success' | 'error' = $state('waiting');
	let errorMessage: string = $state('');

	let qrActionButton: HTMLButtonElement | undefined = $state();
	let secret: string = '';
	let listenerHandles: Awaited<ReturnType<typeof addTvLoginListeners>> = [];
	let countdownInterval: ReturnType<typeof setInterval> | undefined;

	const qrCodeUrl = $derived(
		addresses.length ? `http://${addresses[0]}:${TV_LOGIN_PORT}/?c=${code}` : ''
	);

	async function startSession() {
		const instance = $invidiousInstanceStore;
		if (!qrEnabled || !instance) return;

		code = generateLoginCode();
		secret = generateLoginSecret();
		loginStatus = 'waiting';

		try {
			await startTvLoginSession({
				code,
				secret,
				instance
			});
			secondsLeft = TV_LOGIN_TTL_SECONDS;
		} catch {
			qrFailed($_('loginQr.failed'));
		}
	}

	function qrFailed(message: string) {
		loginStatus = 'error';
		errorMessage = message;
		// The password form must keep working whatever happens to the listener.
		void toggleQr(false);
	}

	async function handleLoginSuccess(auth: { username: string; token: string }) {
		await stopSession();
		qrEnabled = false;

		const authToken = { username: auth.username, token: auth.token };
		invidiousAuthStore.set(authToken);
		if (isMaterialiousAccountActive()) {
			await addOrUpdateKeyValue('authToken', JSON.stringify(authToken));
		}

		loginStatus = 'success';
		goto(resolve('/(app)'), { replace: true });
	}

	async function stopSession() {
		clearInterval(countdownInterval);
		countdownInterval = undefined;
		try {
			await stopTvLoginSession();
		} catch {
			// Node process may already be gone.
		}
	}

	// Keep D-pad focus on a real control whenever the view swaps.
	async function toggleQr(show: boolean) {
		showQr = show;
		await tick();
		(show ? qrActionButton : document.getElementById('username'))?.focus();
	}

	onMount(async () => {
		if (!qrEnabled) {
			document.getElementById('username')?.focus();
			return;
		}
		await tick();
		qrActionButton?.focus();

		listenerHandles = await addTvLoginListeners({
			onSuccess: (auth) => void handleLoginSuccess(auth),
			onNewCode: (newCode) => (code = newCode),
			onError: (message) => qrFailed(message)
		});

		try {
			const { value } = await androidTv.getIpAddresses();
			// Tailscale addresses (100.64.0.0/10) sort after plain LAN addresses.
			addresses = value
				.filter((address) => !address.startsWith('169.254.'))
				.sort((a, b) => Number(a.startsWith('100.')) - Number(b.startsWith('100.')));
		} catch {
			addresses = [];
		}

		if (!addresses.length) {
			qrFailed($_('loginQr.noAddress'));
			return;
		}

		await startSession();
		countdownInterval = setInterval(() => {
			secondsLeft -= 1;
			if (secondsLeft <= 0) void startSession();
		}, 1000);
	});

	onDestroy(() => {
		void stopSession();
		listenerHandles.forEach((handle) => void handle.remove());
	});

	const countdownText = $derived(
		`${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
	);

	async function usernamePasswordLogin(event: Event) {
		event.preventDefault();

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
					goto(resolve('/(app)'), { replace: true });
					return;
				}
			}
		}

		loginError = true;
	}
</script>

<svelte:head>
	<style>
		/* TV focus indicator, same as the TV player layout. */
		:focus {
			outline: 4px solid var(--primary);
			box-shadow: none !important;
		}
	</style>
</svelte:head>

<nav class="center-align">
	<article class="padding left-align">
		<h5>{$_('loginRequired')}</h5>
		<div>{$_('invidiousLogin')}</div>

		<p class="status" class:error-text={loginStatus === 'error'} role="status" aria-live="polite">
			{loginStatus === 'success'
				? $_('loginQr.success')
				: loginStatus === 'error'
					? errorMessage
					: showQr
						? $_('loginQr.waiting')
						: ''}
		</p>

		{#if showQr}
			<div class="qr-login">
				<p>{$_('loginQr.instructions')}</p>
				{#if qrCodeUrl}
					<div
						class="qr-code"
						role="img"
						aria-label={$_('loginQr.qrAriaLabel', { url: qrCodeUrl })}
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html renderSVG(qrCodeUrl)}
					</div>
				{/if}

				<div class="qr-details">
					<span>{$_('loginQr.codeLabel')}</span>
					<code class="code-display">{code}</code>
					{#each addresses as address (address)}
						<div class="address">http://{address}:{TV_LOGIN_PORT}/?c={code}</div>
					{/each}
					<div>{$_('loginQr.expiresIn', { time: countdownText })}</div>
				</div>

				<button
					class="surface-container-highest"
					type="button"
					onclick={() => toggleQr(false)}
					bind:this={qrActionButton}
				>
					{$_('loginQr.usePassword')}
				</button>
			</div>
		{:else}
			{#if qrEnabled && loginStatus !== 'error'}
				<button class="surface-container-highest" type="button" onclick={() => toggleQr(true)}>
					{$_('loginQr.useQr')}
				</button>
			{/if}

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
					<button class="transparent link" type="button" onclick={() => window.history.back()}>
						{$_('cancel')}
					</button>
					<button class="transparent link" type="submit">{$_('login')}</button>
				</nav>
			</form>
		{/if}
	</article>
</nav>

<style>
	article {
		width: 400px;
	}

	@media screen and (max-width: 400px) {
		article {
			width: 100%;
		}
	}

	/* 10-foot UI: 1u = 1px on a 1920-wide screen. */
	@media screen and (min-width: 1280px) {
		article {
			width: calc(900 * 100vw / 1920);
			font-size: calc(28 * 100vw / 1920);
		}

		article :global(h5) {
			font-size: calc(40 * 100vw / 1920);
		}

		article :global(input),
		article :global(label) {
			font-size: calc(28 * 100vw / 1920);
		}

		article :global(input),
		article :global(button) {
			min-height: calc(72 * 100vw / 1920);
		}

		.qr-login {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
			gap: calc(32 * 100vw / 1920);
		}

		.qr-code {
			/* White backing for the QR's quiet zone — scanners need the contrast
			   regardless of theme (same spirit as the black-scrim exception). */
			background: white;
			padding: calc(16 * 100vw / 1920);
			border-radius: calc(16 * 100vw / 1920);
			width: calc(360 * 100vw / 1920);
			height: calc(360 * 100vw / 1920);
		}

		.qr-code :global(svg) {
			width: 100%;
			height: 100%;
			display: block;
		}

		.qr-details {
			display: flex;
			flex-direction: column;
			gap: calc(12 * 100vw / 1920);
		}

		.code-display {
			font-size: calc(72 * 100vw / 1920);
			font-weight: 700;
			letter-spacing: calc(12 * 100vw / 1920);
			color: var(--primary);
		}

		.address {
			font-family: monospace;
			word-break: break-all;
		}

		article :global(button) {
			font-size: calc(28 * 100vw / 1920);
		}
	}

	.status:empty {
		display: none;
	}

	.error-text {
		color: var(--error);
	}
</style>
