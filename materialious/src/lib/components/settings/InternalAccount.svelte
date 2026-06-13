<script lang="ts">
	import { _ } from '$lib/i18n';
	import { materialiousLogout } from '$lib/auth';
	import { resetPasswordBackend, type DerivePassword } from '$lib/api/backend';
	import PasswordStrength from '$lib/components/PasswordStrength.svelte';
	import { onMount } from 'svelte';
	import * as comlink from 'comlink';

	let clickCount = $state(0);
	const clicksToDelte = 3;
	let deleteDebounce: ReturnType<typeof setTimeout> | undefined;
	async function deleteAccount() {
		clickCount++;

		if (deleteDebounce) clearTimeout(deleteDebounce);

		deleteDebounce = setTimeout(() => {
			clickCount = 0;
		}, 10000);

		if (clicksToDelte - clickCount === 0) {
			await fetch('/api/user/delete', { method: 'DELETE' });
			materialiousLogout();
		}
	}

	let worker: Worker | undefined;
	let derivePassword: DerivePassword;

	onMount(() => {
		worker = new Worker(new URL('../../workers/derivePassword.ts', import.meta.url), {
			type: 'module'
		});
		const workerApi = comlink.wrap(worker);
		derivePassword = (workerApi as any).derivePassword as DerivePassword;
	});

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let isResetting = $state(false);
	let statusMessage = $state('');
	let statusType = $state<'success' | 'error' | ''>('');

	async function onResetPassword(event: Event) {
		event.preventDefault();
		statusMessage = '';
		statusType = '';

		if (newPassword !== confirmPassword) {
			statusMessage = $_('layout.passwordsDoNotMatch');
			statusType = 'error';
			return;
		}

		isResetting = true;
		const success = await resetPasswordBackend(currentPassword, newPassword, derivePassword);
		isResetting = false;

		if (success) {
			statusMessage = $_('layout.passwordResetSuccess');
			statusType = 'success';
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} else {
			statusMessage = $_('layout.passwordResetFailed');
			statusType = 'error';
		}
	}
</script>

<h5 class="no-margin">{$_('layout.resetPassword')}</h5>

<form onsubmit={onResetPassword}>
	<div class="field label prefix surface-container-highest">
		<i>password</i>
		<input bind:value={currentPassword} name="currentPassword" type="password" required />
		<label for="currentPassword">{$_('layout.currentPassword')}</label>
	</div>
	<div class="field label prefix surface-container-highest">
		<i>password</i>
		<input bind:value={newPassword} name="newPassword" type="password" required />
		<label for="newPassword">{$_('layout.newPassword')}</label>
	</div>

	<PasswordStrength password={newPassword} />

	<div class="field label prefix surface-container-highest">
		<i>password</i>
		<input bind:value={confirmPassword} name="confirmPassword" type="password" required />
		<label for="confirmPassword">{$_('layout.confirmPassword')}</label>
	</div>

	{#if statusMessage}
		<div
			class="status-message surface-container-highest"
			class:error={statusType === 'error'}
			class:success={statusType === 'success'}
		>
			{statusMessage}
		</div>
	{/if}

	<div class="space"></div>

	<button type="submit" class="secondary" disabled={isResetting}>
		{#if isResetting}
			<progress class="circle indeterminate small"></progress>
		{/if}
		<span>{$_('layout.changePassword')}</span>
	</button>
</form>

<div class="space"></div>
<div class="divider"></div>
<div class="space"></div>

<button class="tertiary" onclick={deleteAccount}>
	<i>warning</i>
	<span>{$_('layout.deleteAccount')}</span>
	{#if clicksToDelte - clickCount > 0}
		<div class="tooltip bottom">
			{$_('layout.clickXmoreTimesToDelete', {
				clicksTillDelete: clicksToDelte - clickCount
			})}
		</div>
	{/if}
</button>

<style>
	.status-message {
		padding: 0.5rem;
		border-radius: 0.5rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
	}

	.status-message.error {
		color: #f44336;
	}

	.status-message.success {
		color: #4caf50;
	}
</style>
