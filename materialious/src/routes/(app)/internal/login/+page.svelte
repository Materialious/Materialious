<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createUserBackend, loginUserBackend, type DerivePassword } from '$lib/api/backend';
	import PageLoading from '$lib/components/PageLoading.svelte';
	import { _ } from '$lib/i18n';
	import { isOwnBackend } from '$lib/shared';
	import 'altcha';
	import * as comlink from 'comlink';
	import { onMount } from 'svelte';
	import { zxcvbn } from '@zxcvbn-ts/core';

	let needToRegister = $state(false);

	let username = $state('');
	let rawPassword = $state('');
	let captchaPayload = $state('');

	let worker: Worker | undefined;
	let derivePassword: DerivePassword;

	let isLoading = $state(false);

	onMount(() => {
		worker = new Worker(new URL('./workers/derivePassword.ts', import.meta.url), {
			type: 'module'
		});
		const workerApi = comlink.wrap(worker);

		derivePassword = (workerApi as any).derivePassword as DerivePassword;
	});

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

		isLoading = true;

		if (needToRegister) {
			failed = !(await createUserBackend(username, rawPassword, captchaPayload, derivePassword));
		} else {
			failed = !(await loginUserBackend(username, rawPassword, captchaPayload, derivePassword));
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
					<article
						class="surface-container-highest no-padding"
						style="width: 100%;height: fit-content;"
					>
						<altcha-widget
							challengeurl="/api/captcha"
							hidelogo
							hidefooter
							onstatechange={(ev) => {
								const { payload, state } = ev.detail;
								if (state === 'verified' && payload) {
									captchaPayload = payload;
								}
							}}
						></altcha-widget>
					</article>
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
