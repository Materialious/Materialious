<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createUserBackend, loginUserBackend } from '$lib/api/backend';
	import { _ } from '$lib/i18n';

	let needToRegister = $state(false);

	let username = $state('');
	let rawPassword = $state('');

	let failed = $state(false);
	async function onLogin(event: Event) {
		event.preventDefault();

		if (needToRegister) {
			failed = !(await createUserBackend(username, rawPassword));
		} else {
			failed = !(await loginUserBackend(username, rawPassword));
		}

		if (!failed) {
			goto(resolve('/', {}), { replaceState: true });
		}
	}
</script>

<nav class="center-align">
	<article class="padding">
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
