<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createUserBackend, loginUserBackend, type DerivePassword } from '#lib/api/backend/index';
	import { backendFetch } from '#lib/api/backend/request';
	import PageLoading from '#lib/components/PageLoading.svelte';
	import { _ } from '#lib/i18n/index';
	import { isOwnBackend } from '#lib/shared/index';
	import * as comlink from 'comlink';
	import { onMount } from 'svelte';
	import PasswordStrength from '#lib/components/PasswordStrength.svelte';
	import QuickConnectReceiver from '#lib/components/QuickConnectReceiver.svelte';
	import { solveChallenge } from 'altcha-lib';
	import type { Solution, Challenge } from 'altcha-lib/types';
	import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';
	import { isAndroidTv } from '#lib/utils';

	const registrationAllowed = $derived(!!isOwnBackend()?.registrationAllowed);
	const captchaDisabled = $derived(!!isOwnBackend()?.captchaDisabled);

	let needToRegister = $state(false);
	let quickConnectMode = $state(isAndroidTv() && !!isOwnBackend()?.quickConnect);

	let username = $state('');
	let rawPassword = $state('');

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
	});

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

		isLoading = true;

		if (needToRegister) {
			failed = !(await createUserBackend(username, rawPassword, captchaPayload!, derivePassword));
		} else {
			failed = !(await loginUserBackend(username, rawPassword, captchaPayload!, derivePassword));
		}

		isLoading = false;

		if (!failed) {
			goto(resolve('/(app)'), { replace: true });
		} else {
			void solveCaptchaChallenge();
		}
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
							<input bind:value={username} name="username" type="text" />
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
							<input bind:value={rawPassword} name="password" type="password" />
							<label for="password">{$_('password')}</label>
							{#if failed && !needToRegister}
								<output class="invalid">{$_('invalidPassword')}</output>
							{/if}
						</div>

						<PasswordStrength password={rawPassword} show={needToRegister} />

						<nav class="right-align">
							<button
								type="button"
								class="secondary"
								disabled={!registrationAllowed}
								onclick={() => {
									needToRegister = !needToRegister;
									failed = false;
								}}
							>
								{#if !registrationAllowed}
									<div class="tooltip bottom">{$_('registrationDisabled')}</div>
								{/if}
								<span>{$_(!needToRegister ? 'needRegister' : 'needLogin')}</span>
							</button>
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
</style>
