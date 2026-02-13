<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createUserBackend, loginUserBackend } from '$lib/api/backend';
	import { _ } from '$lib/i18n';
	import 'altcha';

	let needToRegister = $state(false);

	let username = $state('');
	let rawPassword = $state('');
	let captchaPayload = $state('');

	let failed = $state(false);
	async function onLogin(event: Event) {
		event.preventDefault();

		if (needToRegister) {
			failed = !(await createUserBackend(username, rawPassword, captchaPayload));
		} else {
			failed = !(await loginUserBackend(username, rawPassword, captchaPayload));
		}

		if (!failed) {
			goto(resolve('/', {}), { replaceState: true });
		}
	}
</script>

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

			<nav class="right-align">
				<button
					type="button"
					class="secondary"
					onclick={() => {
						needToRegister = !needToRegister;
						failed = false;
					}}
				>
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

<style>
	article {
		width: 400px;
	}

	@media screen and (max-width: 400px) {
		article {
			width: 100%;
		}
	}
</style>
