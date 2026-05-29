<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createUserBackend, loginUserBackend, type DerivePassword } from '$lib/api/backend';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { _ } from '$lib/i18n';
	import { isOwnBackend } from '$lib/shared';
	import * as comlink from 'comlink';
	import { onMount } from 'svelte';
	import { zxcvbn } from '@zxcvbn-ts/core';
	import { solveChallenge } from 'altcha-lib';
	import type { Solution, Challenge } from 'altcha-lib/types';
	import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';

	let needToRegister = $state(false);

	let username = $state('');
	let rawPassword = $state('');

	type CaptchaPayload = { solution: Solution; challenge: Challenge };
	let captchaPayload = $state<CaptchaPayload | null>(null);
	let captchaState = $state<'idle' | 'solving' | 'solved' | 'error'>('idle');

	let worker: Worker | undefined;
	let derivePassword: DerivePassword;

	let isLoading = $state(false);

	onMount(() => {
		worker = new Worker(new URL('./workers/derivePassword.ts', import.meta.url), {
			type: 'module'
		});
		const workerApi = comlink.wrap(worker);

		derivePassword = (workerApi as any).derivePassword as DerivePassword;

		if (!isOwnBackend()?.captchaDisabled) {
			solveCaptchaChallenge();
		}
	});

	async function solveCaptchaChallenge() {
		captchaState = 'solving';

		try {
			const resp = await fetch('/api/captcha');
			const challenge = await resp.json();

			const solution = await solveChallenge({ challenge, deriveKey });

			if (!solution) {
				captchaState = 'error';
				return;
			}

			captchaPayload = {
				solution,
				challenge
			};
			captchaState = 'solved';
		} catch {
			captchaState = 'error';
		}
	}

	let failed = $state(false);
	let passwordStrength = $state<{
		score: number;
		feedback: { warning: string | null; suggestions: string[] };
	} | null>(null);

	let strengthLabelKey = $derived(
		!passwordStrength
			? ''
			: passwordStrength.score === 0
				? 'veryWeak'
				: passwordStrength.score === 1
					? 'weak'
					: passwordStrength.score === 2
						? 'fair'
						: passwordStrength.score === 3
							? 'strong'
							: 'veryStrong'
	);

	$effect(() => {
		if (needToRegister && rawPassword) {
			const result = zxcvbn(rawPassword);
			passwordStrength = { score: result.score, feedback: result.feedback };
		} else {
			passwordStrength = null;
		}
	});

	async function onLogin(event: Event) {
		event.preventDefault();

		if (!captchaPayload && !isOwnBackend()?.captchaDisabled) {
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
			goto(resolve('/', {}), { replaceState: true });
		}
	}
</script>

{#if isLoading}
	<PageLoading />
{:else}
	<nav class="center-align">
		<article class="padding left-align">
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

				{#if needToRegister && passwordStrength}
					<div class="password-strength">
						<div class="strength-bar">
							<div class={`score-${passwordStrength.score} strength-fill`}></div>
						</div>
						<span class="strength-label">{$_(strengthLabelKey)}</span>
					</div>
				{/if}

				{#if !isOwnBackend()?.captchaDisabled}
					<div class="space"></div>
					<div class="surface-container-highest center-align small-padding max">
						{#if captchaState === 'solving'}
							<div class="center-align middle-align horizontal">
								<progress class="circle indeterminate small" value="50" max="100"></progress>
								<span class="small-text">{$_('verifyingCaptcha')}</span>
							</div>
						{:else if captchaState === 'solved'}
							<div class="center-align horizontal">
								<i class="green-text">check_circle</i>
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

				<nav class="right-align">
					<button
						type="button"
						class="secondary"
						disabled={!isOwnBackend()?.registrationAllowed}
						onclick={() => {
							needToRegister = !needToRegister;
							failed = false;
						}}
					>
						{#if !isOwnBackend()?.registrationAllowed}
							<div class="tooltip bottom">{$_('registrationDisabled')}</div>
						{/if}
						<span>{$_(!needToRegister ? 'needRegister' : 'needLogin')}</span>
					</button>

					<button type="submit">
						<i>done</i>
						<span>{$_(needToRegister ? 'createAccount' : 'login')}</span>
					</button>
				</nav>
			</form>
		</article>
	</nav>
{/if}

<style>
	article {
		width: 400px;
	}

	.password-strength {
		margin-top: 0.5rem;
		padding: 0 0.5rem;
	}

	.strength-bar {
		height: 4px;
		background: var(--secondary);
		border-radius: 2px;
		overflow: hidden;
	}

	.strength-fill {
		height: 100%;
		transition:
			width 0.2s ease,
			background-color 0.2s ease;
	}

	.strength-fill.score-0 {
		width: 20%;
		background: #f44336;
	}
	.strength-fill.score-1 {
		width: 40%;
		background: #ff9800;
	}
	.strength-fill.score-2 {
		width: 60%;
		background: #ffeb3b;
	}
	.strength-fill.score-3 {
		width: 80%;
		background: #8bc34a;
	}
	.strength-fill.score-4 {
		width: 100%;
		background: #4caf50;
	}

	.strength-label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		margin-top: 0.25rem;
	}

	@media screen and (max-width: 400px) {
		article {
			width: 100%;
		}
	}
</style>
