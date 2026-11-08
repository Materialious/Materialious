<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { _, locale } from '#lib/i18n/index';
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
		readTheme,
		readWebStrings,
		startTvLoginSession,
		stopTvLoginSession
	} from '#lib/tvQrLogin';
	import QR from '@svelte-put/qr/svg/QR.svelte';
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

		code = await generateLoginCode();
		secret = await generateLoginSecret();
		loginStatus = 'waiting';

		try {
			await startTvLoginSession({
				code,
				secret,
				instance,
				theme: await readTheme(),
				strings: readWebStrings($_),
				lang: $locale
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

{#snippet heading()}
	<h1 id="tv-login-title">{$_('loginRequired')}</h1>
	<p class="subtitle">{$_('invidiousLogin')}</p>
{/snippet}

{#snippet status()}
	<p class="status" class:error-text={loginStatus === 'error'} role="status" aria-live="polite">
		{loginStatus === 'success'
			? $_('loginQr.success')
			: loginStatus === 'error'
				? errorMessage
				: showQr
					? $_('loginQr.waiting')
					: ''}
	</p>
{/snippet}

<section class="tv-login" class:with-qr={showQr} aria-labelledby="tv-login-title">
	{#if showQr}
		<div
			class="qr-tile"
			role={qrCodeUrl ? 'img' : undefined}
			aria-label={qrCodeUrl ? $_('loginQr.qrAriaLabel', { url: qrCodeUrl }) : undefined}
		>
			{#if qrCodeUrl}
				<QR
					data={qrCodeUrl}
					margin={0}
					moduleFill="black"
					anchorInnerFill="black"
					anchorOuterFill="black"
				/>
			{/if}
		</div>

		<div class="details">
			{@render heading()}

			<ol class="steps">
				<li>{$_('loginQr.stepScan')}</li>
				<li>
					{$_('loginQr.stepAddress')}
					{#each addresses as address, index (address)}
						<span class="address" class:alt-address={index > 0}>
							http://{address}:{TV_LOGIN_PORT}
						</span>
					{/each}
				</li>
				<li>{$_('loginQr.stepCode')}</li>
			</ol>

			<div class="code-block">
				<span class="code-label">{$_('loginQr.codeLabel')}</span>
				<!-- Screen readers get the code letter by letter instead of as one made-up word. -->
				<code class="code" aria-hidden="true">{code}</code>
				<span class="visually-hidden">{code.split('').join(' ')}</span>
				<span class="countdown">{$_('loginQr.expiresIn', { time: countdownText })}</span>
			</div>

			{@render status()}

			<nav class="actions">
				<button
					class="surface-container-highest"
					type="button"
					onclick={() => toggleQr(false)}
					bind:this={qrActionButton}
				>
					<i aria-hidden="true">password</i>
					<span>{$_('loginQr.usePassword')}</span>
				</button>
			</nav>
		</div>
	{:else}
		<div class="details">
			{@render heading()}
			{@render status()}

			<form onsubmit={usernamePasswordLogin}>
				<div class="field label border" class:invalid={loginError}>
					<input
						id="username"
						bind:value={rawUsername}
						name="username"
						type="text"
						autocomplete="username"
						aria-invalid={loginError}
						aria-describedby={loginError ? 'login-error' : undefined}
					/>
					<label for="username">{$_('username')}</label>
				</div>
				<div class="field label border" class:invalid={loginError}>
					<input
						id="password"
						bind:value={rawPassword}
						name="password"
						type="password"
						autocomplete="current-password"
						aria-invalid={loginError}
						aria-describedby={loginError ? 'login-error' : undefined}
					/>
					<label for="password">{$_('password')}</label>
				</div>
				{#if loginError}
					<p id="login-error" class="error-text" role="alert">{$_('loginQr.passwordError')}</p>
				{/if}

				<nav class="actions">
					<button type="submit">{$_('login')}</button>
					<button class="border" type="button" onclick={() => window.history.back()}>
						{$_('cancel')}
					</button>
					{#if qrEnabled && loginStatus !== 'error'}
						<button class="surface-container-highest" type="button" onclick={() => toggleQr(true)}>
							<i aria-hidden="true">qr_code_2</i>
							<span>{$_('loginQr.useQr')}</span>
						</button>
					{/if}
				</nav>
			</form>
		</div>
	{/if}
</section>

<style>
	/* 10-foot UI. 1u = 1px of a 1920x1080 layout, shrunk to whichever axis is tighter so the
	   page always fits without scrolling. */
	.tv-login {
		--u: min(calc(100vw / 1920), calc(100vh / 1080));
		box-sizing: border-box;
		height: 100%;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, calc(760 * var(--u)));
		justify-content: center;
		align-content: center;
		gap: calc(96 * var(--u));
		padding: calc(48 * var(--u)) calc(64 * var(--u));
		font-size: calc(26 * var(--u));
		line-height: 1.45;
		color: var(--on-surface);
	}

	.tv-login.with-qr {
		grid-template-columns: auto minmax(0, calc(760 * var(--u)));
		align-items: center;
	}

	/* The on-screen keyboard shrinks the viewport height while typing; scale from width only
	   and anchor to the top so the form keeps its size and stays above the keyboard. */
	.tv-login:not(.with-qr) {
		--u: calc(100vw / 1920);
		align-content: start;
		padding-top: calc(96 * var(--u));
	}

	.qr-tile {
		/* Scanners need dark-on-light with a quiet zone, whatever the app theme. */
		background: #fff;
		width: calc(440 * var(--u));
		aspect-ratio: 1;
		padding: calc(28 * var(--u));
		border-radius: calc(28 * var(--u));
		box-sizing: border-box;
	}

	.qr-tile :global(svg) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.details {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}

	h1 {
		margin: 0;
		font-size: calc(44 * var(--u));
		line-height: 1.15;
		font-weight: 600;
		text-wrap: balance;
	}

	.subtitle {
		margin: calc(10 * var(--u)) 0 0;
		color: var(--on-surface-variant);
	}

	.steps {
		margin: calc(40 * var(--u)) 0 0;
		padding-inline-start: 1.4em;
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
	}

	.steps li::marker {
		color: var(--primary);
		font-weight: 700;
	}

	.address {
		display: block;
		margin-top: calc(6 * var(--u));
		font-family: monospace;
		font-size: calc(30 * var(--u));
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.address.alt-address {
		font-size: calc(24 * var(--u));
		font-weight: 400;
		color: var(--on-surface-variant);
	}

	.code-block {
		margin-top: calc(36 * var(--u));
		display: grid;
		grid-template-columns: auto auto;
		justify-content: start;
		align-items: baseline;
		column-gap: calc(28 * var(--u));
	}

	.code-label {
		grid-column: 1 / -1;
		color: var(--on-surface-variant);
		font-size: calc(22 * var(--u));
	}

	.code {
		font-family: monospace;
		font-size: calc(76 * var(--u));
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0.12em;
		font-variant-numeric: tabular-nums;
		color: var(--primary);
		background: none;
		padding: 0;
	}

	.countdown {
		color: var(--on-surface-variant);
		font-size: calc(22 * var(--u));
		font-variant-numeric: tabular-nums;
	}

	.status {
		margin: calc(24 * var(--u)) 0 0;
		color: var(--on-surface-variant);
	}

	.status:empty {
		display: none;
	}

	.error-text {
		color: var(--error);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.actions {
		margin-top: calc(36 * var(--u));
		display: flex;
		flex-wrap: wrap;
		gap: calc(20 * var(--u));
	}

	form {
		width: 100%;
		margin-top: calc(32 * var(--u));
	}

	.tv-login :global(button) {
		min-height: calc(72 * var(--u));
		padding-inline: calc(32 * var(--u));
		font-size: calc(26 * var(--u));
		border-radius: calc(36 * var(--u));
		gap: calc(12 * var(--u));
	}

	.tv-login :global(button > i) {
		font-size: calc(32 * var(--u));
	}

	.tv-login .field :global(input),
	.tv-login .field :global(label) {
		font-size: calc(26 * var(--u));
	}

	.tv-login .field {
		height: calc(80 * var(--u));
		margin-block: calc(20 * var(--u));
	}

	.tv-login .field :global(input) {
		height: 100%;
	}
</style>
