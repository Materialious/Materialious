<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { _ } from '#lib/i18n/index';
	import { isAndroidTv } from '#lib/utils';
	import PageLoading from '#lib/components/PageLoading.svelte';
	import { goToInvidiousLogin, clearCaches } from '#lib/auth';
	import { invidiousAuthStore, invidiousInstanceStore } from '#lib/store';
	import {
		loginInvidiousWithPassword,
		supportsInvidiousPasswordLogin
	} from '#lib/api/invidious/login';
	import { addOrUpdateKeyValue } from '#lib/api/backend/keyvalue';
	import { isMaterialiousAccountActive } from '#lib/backend';
	import type { InvidiousLoginError } from '@materialious/shared/invidious';

	let username = $state('');
	let password = $state('');
	let pending = $state(false);
	let loginError = $state<InvidiousLoginError | null>(null);
	const passwordSupported = supportsInvidiousPasswordLogin();
	const tokenSupported = !isAndroidTv();
	let method = $state<'token' | 'password'>(tokenSupported ? 'token' : 'password');

	function selectMethod(selected: 'token' | 'password') {
		if (pending || (selected === 'token' && !tokenSupported)) return;
		method = selected;
		loginError = null;
		password = '';
	}

	function handleTabKey(event: KeyboardEvent) {
		let selected: 'token' | 'password';
		if (event.key === 'Home') selected = 'token';
		else if (event.key === 'End') selected = 'password';
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			selected = method === 'token' ? 'password' : 'token';
		} else return;
		event.preventDefault();
		selectMethod(selected);
		document.getElementById(`invidious-${selected}-tab`)?.focus();
	}

	async function passwordLogin(event: SubmitEvent) {
		event.preventDefault();
		if (pending || !passwordSupported || !$invidiousInstanceStore) return;
		const instance = $invidiousInstanceStore;
		pending = true;
		loginError = null;
		try {
			const result = await loginInvidiousWithPassword({ instance, username, password });
			if (!result.ok) {
				loginError = result.error;
				return;
			}
			if ($invidiousInstanceStore !== instance) return;
			if (isMaterialiousAccountActive()) {
				await addOrUpdateKeyValue('authToken', JSON.stringify(result.session));
			}
			if ($invidiousInstanceStore !== instance) return;
			invidiousAuthStore.set(result.session);
			clearCaches();
			await goto(resolve('/(app)'), { replace: true });
		} catch {
			loginError = 'network';
		} finally {
			password = '';
			pending = false;
		}
	}

	async function tokenLogin() {
		if (pending || !tokenSupported || !$invidiousInstanceStore) return;
		pending = true;
		loginError = null;
		try {
			await goToInvidiousLogin();
		} catch {
			loginError = 'network';
		} finally {
			pending = false;
		}
	}
</script>

{#if pending}
	<PageLoading />
{:else}
	<nav class="center-align">
		<article class="padding left-align login-card">
			{#if tokenSupported}
				<div class="tabs scroll" role="tablist" aria-label={$_('login')}>
					<a
						id="invidious-token-tab"
						href="#token"
						role="tab"
						aria-controls="invidious-token-login"
						aria-selected={method === 'token'}
						tabindex={method === 'token' ? 0 : -1}
						class:active={method === 'token'}
						onkeydown={handleTabKey}
						onclick={(event) => {
							event.preventDefault();
							selectMethod('token');
						}}>{$_('invidiousAuth.tokenTab')}</a
					>
					<a
						id="invidious-password-tab"
						href="#password"
						role="tab"
						aria-controls="invidious-password-login"
						aria-selected={method === 'password'}
						tabindex={method === 'password' ? 0 : -1}
						class:active={method === 'password'}
						onkeydown={handleTabKey}
						onclick={(event) => {
							event.preventDefault();
							selectMethod('password');
						}}>{$_('loginWithPassword')}</a
					>
				</div>
				<div class="space"></div>
			{/if}

			{#if method === 'token' && tokenSupported}
				<div id="invidious-token-login" role="tabpanel" aria-labelledby="invidious-token-tab">
					<h3>{$_('login')}</h3>
					<p class="no-margin">{$_('invidiousLogin')}</p>
					<p class="instance">{$invidiousInstanceStore}</p>
					<p>{$_('invidiousAuth.tokenDescription')}</p>
					<nav class="right-align">
						<a class="button transparent link" href={resolve('/(app)')}>{$_('cancel')}</a>
						<button type="button" disabled={!$invidiousInstanceStore} onclick={tokenLogin}>
							<i>key</i>
							<span>{$_('login')}</span>
						</button>
					</nav>
				</div>
			{:else}
				<div
					id="invidious-password-login"
					role={tokenSupported ? 'tabpanel' : undefined}
					aria-labelledby={tokenSupported ? 'invidious-password-tab' : undefined}
				>
					<h3>{$_('login')}</h3>
					<p class="no-margin">{$_('invidiousLogin')}</p>
					<p class="instance">{$invidiousInstanceStore}</p>
					{#if passwordSupported}
						<p>{$_('invidiousAuth.registrationWarning')}</p>
						<form onsubmit={passwordLogin}>
							<div
								class="field label prefix surface-container-highest"
								class:invalid={loginError === 'credentials'}
							>
								<i>person</i>
								<input
									id="invidious-username"
									bind:value={username}
									name="username"
									type="text"
									autocomplete="username"
									placeholder=" "
									required
								/>
								<label for="invidious-username">{$_('username')}</label>
							</div>
							<div
								class="field label prefix surface-container-highest"
								class:invalid={loginError === 'credentials'}
							>
								<i>password</i>
								<input
									id="invidious-password"
									bind:value={password}
									name="password"
									type="password"
									autocomplete="current-password"
									placeholder=" "
									required
								/>
								<label for="invidious-password">{$_('password')}</label>
							</div>
							<nav class="right-align">
								<a class="button transparent link" href={resolve('/(app)')}>{$_('cancel')}</a>
								<button type="submit" disabled={!$invidiousInstanceStore}>
									<i>done</i>
									<span>{$_('login')}</span>
								</button>
							</nav>
						</form>
					{:else}
						<p>{$_('invidiousAuth.passwordUnavailable')}</p>
						<nav class="right-align">
							<a class="button transparent link" href={resolve('/(app)')}>{$_('cancel')}</a>
						</nav>
					{/if}
				</div>
			{/if}
			{#if loginError}
				<p class="error-text" role="alert">{$_(`invidiousAuth.errors.${loginError}`)}</p>
			{/if}
		</article>
	</nav>
{/if}

<style>
	.login-card {
		width: 100%;
		max-width: 440px;
	}

	.instance {
		overflow-wrap: anywhere;
	}
</style>
