<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createUserBackend, loginUserBackend, type DerivePassword } from '#lib/api/backend/index';
	import { backendFetch } from '#lib/api/backend/request';
	import { materialiousBackendStore } from '#lib/store';
	import PageLoading from '#lib/components/PageLoading.svelte';
	import { _ } from '#lib/i18n/index';
	import { isOwnBackend } from '#lib/shared/index';
	import * as comlink from 'comlink';
	import { onMount, onDestroy } from 'svelte';
	import PasswordStrength from '#lib/components/PasswordStrength.svelte';
	import QuickConnectReceiver from '#lib/components/QuickConnectReceiver.svelte';
	import { solveChallenge } from 'altcha-lib';
	import type { Solution, Challenge } from 'altcha-lib/types';
	import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';
	import { isAndroidTv } from '#lib/utils';
	import { PinInput } from 'melt/builders';

	const registrationAllowed = $derived(!!isOwnBackend()?.registrationAllowed);
	const captchaDisabled = $derived(!!isOwnBackend()?.captchaDisabled);

	let needToRegister = $state(false);
	let quickConnectMode = $state(isAndroidTv() && !!isOwnBackend()?.quickConnect);

	let username = $state('');
	let rawPassword = $state('');
	let twoFactorRequired = $state(false);
	let twoFactorToken = $state('');
	const twoFactorPin = new PinInput({
		maxLength: 6,
		type: 'numeric',
		value: () => twoFactorToken,
		onValueChange: (value) => (twoFactorToken = value)
	});

	type CaptchaPayload = { solution: Solution; challenge: Challenge };
	let captchaPayload = $state<CaptchaPayload | null>(null);
	let captchaState = $state<'idle' | 'solving' | 'solved' | 'error'>('idle');
	let captchaRequest: Promise<boolean> | null = null;

	let worker: Worker | undefined;
	let derivePassword: DerivePassword;

	let isLoading = $state(false);

	onMount(() => {
		worker = new Worker(new URL('../../../../lib/workers/derivePassword.ts', import.meta.url), {
			type: 'module'
		});
		const workerApi = comlink.wrap(worker);

		derivePassword = (workerApi as any).derivePassword as DerivePassword;

		void solveCaptchaChallenge();
		return materialiousBackendStore.subscribe(cancelTwoFactor);
	});

	onDestroy(() => worker?.terminate());

	function cancelTwoFactor() {
		twoFactorRequired = false;
		twoFactorToken = '';
		rawPassword = '';
		failed = false;
	}

	function solveCaptchaChallenge(): Promise<boolean> {
		if (captchaDisabled) {
			return Promise.resolve(true);
		}
		if (captchaRequest) return captchaRequest;

		captchaPayload = null;
		captchaState = 'solving';

		captchaRequest = (async () => {
			try {
				const resp = await backendFetch('/api/captcha');
				const challenge = await resp.json();

				// If the remote backend has captcha disabled, it returns an empty body.
				if (Object.keys(challenge).length === 0) {
					captchaState = 'solved';
					return true;
				}

				const solution = await solveChallenge({ challenge, deriveKey });

				if (!solution) {
					captchaState = 'error';
					return false;
				}

				captchaPayload = {
					solution,
					challenge
				};
				captchaState = 'solved';
				return true;
			} catch {
				captchaState = 'error';
				return false;
			}
		})().finally(() => {
			captchaRequest = null;
		});
		return captchaRequest;
	}

	async function getQuickConnectCaptcha() {
		if (captchaDisabled) return { verified: true, payload: null };
		if (captchaState !== 'solved') await solveCaptchaChallenge();
		return { verified: captchaState === 'solved', payload: captchaPayload };
	}

	let failed = $state(false);

	async function onLogin(event: Event) {
		event.preventDefault();

		if (captchaState !== 'solved' && !captchaDisabled) {
			return;
		}

		if (isLoading || !derivePassword) return;
		isLoading = true;
		failed = false;
		try {
			const result = needToRegister
				? (await createUserBackend(username, rawPassword, captchaPayload, derivePassword))
					? 'success'
					: 'failed'
				: await loginUserBackend(
						username,
						rawPassword,
						captchaPayload,
						derivePassword,
						twoFactorRequired ? twoFactorToken : undefined
					);
			if (result === 'success') {
				cancelTwoFactor();
				await goto(resolve('/(app)'), { replace: true });
				return;
			}
			if (result === 'two_factor_required') twoFactorRequired = true;
			else failed = true;
		} catch {
			failed = true;
		} finally {
			isLoading = false;
			twoFactorToken = '';
		}
		void solveCaptchaChallenge();
	}

	function onQuickConnected() {
		goto(resolve('/(app)'), { replace: true });
	}
</script>

{#if isLoading}
	<PageLoading />
{:else}
	<nav class="center-align">
		<article class="padding left-align login-card">
			{#if isOwnBackend()?.quickConnect}
				<div class="tabs scroll" role="tablist" aria-label={$_('login')}>
					<a
						id="password-login-tab"
						href="#password"
						role="tab"
						aria-controls="password-login"
						aria-selected={!quickConnectMode}
						class:active={!quickConnectMode}
						onclick={(event) => {
							event.preventDefault();
							quickConnectMode = false;
						}}>{$_('loginWithPassword')}</a
					>
					<a
						id="quick-connect-login-tab"
						href="#quick-connect"
						role="tab"
						aria-controls="quick-connect-login"
						aria-selected={quickConnectMode}
						class:active={quickConnectMode}
						onclick={(event) => {
							event.preventDefault();
							cancelTwoFactor();
							quickConnectMode = true;
						}}>{$_('loginWithQuickConnect')}</a
					>
				</div>
				<div class="space"></div>
			{/if}
			{#if !quickConnectMode}
				<div
					id="password-login"
					role={isOwnBackend()?.quickConnect ? 'tabpanel' : undefined}
					aria-labelledby={isOwnBackend()?.quickConnect ? 'password-login-tab' : undefined}
				>
					<h3>{$_(needToRegister ? 'createAccount' : 'login')}</h3>
					<p class="no-margin">{$_(needToRegister ? 'materialiousCreate' : 'materialiousLogin')}</p>

					<form onsubmit={onLogin}>
						<div
							class="field label prefix surface-container-highest"
							class:invalid={failed && needToRegister}
						>
							<i>person</i>
							<input
								bind:value={username}
								id="username"
								name="username"
								type="text"
								disabled={twoFactorRequired}
								required
							/>
							<label for="username">{$_('username')}</label>
							{#if failed && needToRegister}
								<output class="invalid">{$_('usernameTaken')}</output>
							{/if}
						</div>
						<div
							class="field label prefix surface-container-highest"
							class:invalid={failed && !needToRegister}
						>
							<i>password</i>
							<input
								bind:value={rawPassword}
								id="password"
								name="password"
								type="password"
								disabled={twoFactorRequired}
								required
							/>
							<label for="password">{$_('password')}</label>
							{#if failed && !needToRegister}
								<output class="invalid"
									>{$_(twoFactorRequired ? 'twoFactor.loginFailed' : 'invalidPassword')}</output
								>
							{/if}
						</div>

						{#if twoFactorRequired}
							<p role="status">{$_('twoFactor.enterCode')}</p>
							{#if !isAndroidTv()}
								<span id="two-factor-code-label">{$_('twoFactor.code')}</span>
							{/if}
							<div class="row wrap" class:no-margin={!isAndroidTv()}>
								{#if isAndroidTv()}
									<div class="field label prefix surface-container-highest max no-margin">
										<i>security</i>
										<input
											id="login-two-factor"
											bind:value={twoFactorToken}
											type="text"
											inputmode="numeric"
											autocomplete="one-time-code"
											pattern={'[0-9]{6}'}
											minlength="6"
											maxlength="6"
											placeholder=" "
											required
										/>
										<label for="login-two-factor">{$_('twoFactor.code')}</label>
									</div>
								{:else}
									<div class="max two-factor-code">
										<div
											{...twoFactorPin.root}
											class="two-factor-pin"
											role="group"
											aria-labelledby="two-factor-code-label"
										>
											{#each twoFactorPin.inputs as input, index (index)}
												<div
													class="field border surface-container-highest no-margin two-factor-digit"
												>
													<input
														{...input}
														value={twoFactorToken[index] ?? ''}
														aria-label={`${$_('twoFactor.code')} ${index + 1}`}
														autocomplete={index === 0 ? 'one-time-code' : 'off'}
														pattern="[0-9]"
														required
													/>
												</div>
											{/each}
										</div>
									</div>
								{/if}
								<button type="button" class="secondary" onclick={cancelTwoFactor}
									>{$_('cancel')}</button
								>
							</div>
						{/if}

						<PasswordStrength password={rawPassword} show={needToRegister} />

						<nav class="right-align">
							<span class="registration-toggle">
								<button
									type="button"
									class="secondary"
									disabled={!registrationAllowed || twoFactorRequired}
									onclick={() => {
										needToRegister = !needToRegister;
										cancelTwoFactor();
									}}
								>
									<span>{$_(!needToRegister ? 'needRegister' : 'needLogin')}</span>
								</button>
								{#if !registrationAllowed}
									<div class="tooltip bottom">{$_('registrationDisabled')}</div>
								{/if}
							</span>
							<button type="submit" disabled={captchaState !== 'solved' && !captchaDisabled}>
								<i>done</i>
								<span>{$_(needToRegister ? 'createAccount' : 'login')}</span>
							</button>
						</nav>
					</form>
				</div>
			{:else}
				<div id="quick-connect-login" role="tabpanel" aria-labelledby="quick-connect-login-tab">
					<h3>{$_('quickConnect.title')}</h3>
					<p class="no-margin">{$_('quickConnect.subtitle')}</p>
					<QuickConnectReceiver
						onConnected={onQuickConnected}
						getCaptcha={getQuickConnectCaptcha}
						onCaptchaUsed={() => void solveCaptchaChallenge()}
					/>
				</div>
			{/if}
			{#if !captchaDisabled}
				<div class="space"></div>
				<div class="surface-container-highest center-align small-padding max">
					{#if captchaState === 'solving'}
						<div class="center-align middle-align horizontal">
							<progress class="circle indeterminate small" value="50" max="100"></progress>
							<span class="small-text">{$_('verifyingCaptcha')}</span>
						</div>
					{:else if captchaState === 'solved'}
						<div class="center-align horizontal">
							<i class="primary-text">check_circle</i>
							<span>{$_('captchaVerified')}</span>
						</div>
					{:else if captchaState === 'error'}
						<div class="center-align horizontal">
							<i class="red-text">error</i>
							<span>{$_('captchaFailed')}</span>
							<button
								type="button"
								class="chip circle small red-text"
								onclick={solveCaptchaChallenge}
							>
								<i>refresh</i>
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</article>
	</nav>
{/if}

<style>
	.login-card {
		width: 100%;
		max-width: 440px;
	}

	.two-factor-code {
		min-width: min(100%, 15rem);
	}

	.two-factor-pin {
		display: flex;
		gap: 0.5rem;
	}

	.two-factor-digit {
		flex: 1;
		min-width: 0;
	}

	.two-factor-digit input {
		padding-inline: 0;
		text-align: center;
	}

	.registration-toggle {
		position: relative;
		display: inline-flex;
	}
</style>
