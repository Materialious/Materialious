<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { _ } from '$lib/i18n';
	import { invidiousAuthStore, invidiousInstanceStore } from '$lib/store';
	import { onMount } from 'svelte';

	let loginError: boolean = $state(false);
	let rawUsername: string = $state('');
	let rawPassword: string = $state('');

	onMount(() => {
		document.getElementById('username')?.focus();
	});

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
					goto(resolve('/', {}), { replaceState: true });
					return;
				}
			}
		}

		loginError = true;
	}
</script>

<nav class="center-align">
	<article class="padding left-align">
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
				<button class="transparent link" type="button" onclick={() => window.history.back()}>
					{$_('cancel')}
				</button>
				<button class="transparent link" type="submit">{$_('login')}</button>
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
