<script lang="ts">
	import { _ } from '#lib/i18n/index';
	import { materialiousLogout } from '#lib/auth';
	import {
		deleteUserBackend,
		resetPasswordBackend,
		type DerivePassword
	} from '#lib/api/backend/index';
	import PasswordStrength from '#lib/components/PasswordStrength.svelte';
	import QuickConnect from './QuickConnect.svelte';
	import TwoFactor from './TwoFactor.svelte';
	import { isOwnBackend } from '#lib/shared/index';
	import { onMount, onDestroy } from 'svelte';
	import * as comlink from 'comlink';
	import { disableSettingsSyncStore, materialiousBackendStore } from '#lib/store';
	import { exportSettingsToAccount, importSettingsFromAccount } from '#lib/externalSettings/index';

	let showDeleteAccount = $state(false);
	let deletePassword = $state('');
	let isDeleting = $state(false);
	let deleteFailed = $state(false);

	function cancelDeleteAccount() {
		showDeleteAccount = false;
		deletePassword = '';
		deleteFailed = false;
	}

	async function deleteAccount(event: SubmitEvent) {
		event.preventDefault();
		if (isDeleting || !derivePassword || !deletePassword) return;
		isDeleting = true;
		deleteFailed = false;
		try {
			if (!(await deleteUserBackend(deletePassword, derivePassword))) {
				deleteFailed = true;
				return;
			}
			cancelDeleteAccount();
			await materialiousLogout();
		} catch {
			deleteFailed = true;
		} finally {
			deletePassword = '';
			isDeleting = false;
		}
	}

	let worker: Worker | undefined;
	let derivePassword = $state<DerivePassword>();

	onMount(() => {
		worker = new Worker(new URL('../../workers/derivePassword.ts', import.meta.url), {
			type: 'module'
		});
		const workerApi = comlink.wrap(worker);
		derivePassword = (workerApi as any).derivePassword as DerivePassword;
		return materialiousBackendStore.subscribe(cancelDeleteAccount);
	});

	onDestroy(() => worker?.terminate());

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let isResetting = $state(false);
	let statusMessage = $state('');
	let statusType = $state<'success' | 'error' | ''>('');
	let settingsTransferMessage = $state('');
	let settingsTransferError = $state(false);

	async function transferSettings(action: 'import' | 'export') {
		settingsTransferMessage = '';
		settingsTransferError = false;
		try {
			if (action === 'import') await importSettingsFromAccount();
			else await exportSettingsToAccount();
			settingsTransferMessage = $_(
				action === 'import'
					? 'layout.settingsImportedFromAccount'
					: 'layout.settingsExportedToAccount'
			);
		} catch (error) {
			settingsTransferError = true;
			settingsTransferMessage = error instanceof Error ? error.message : String(error);
		}
	}

	async function onResetPassword(event: Event) {
		event.preventDefault();
		statusMessage = '';
		statusType = '';

		if (newPassword !== confirmPassword) {
			statusMessage = $_('layout.passwordsDoNotMatch');
			statusType = 'error';
			return;
		}

		if (!derivePassword) return;
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

{#if isOwnBackend()?.quickConnect}
	<h5 class="no-margin">{$_('quickConnect.senderTitle')}</h5>
	<p class="small-text no-margin">{$_('quickConnect.senderDescription')}</p>
	<QuickConnect />
	<div class="space"></div>
	<div class="divider"></div>
	<div class="space"></div>
{/if}

{#if isOwnBackend()?.twoFactorAuth && derivePassword}
	{#key $materialiousBackendStore}
		<TwoFactor {derivePassword} />
	{/key}
	<div class="space"></div>
	<div class="divider"></div>
	<div class="space"></div>
{/if}

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

<div class="field no-margin">
	<nav class="no-padding">
		<div class="max">
			<h6>{$_('layout.disableSettingsSync')}</h6>
			<div class="small-text">{$_('layout.disableSettingsSyncDescription')}</div>
		</div>
		<label class="switch">
			<input type="checkbox" role="switch" bind:checked={$disableSettingsSyncStore} />
			<span></span>
		</label>
	</nav>
</div>

<div class="space"></div>
<button class="surface-container-highest" onclick={() => transferSettings('export')}>
	<i>file_export</i>
	<span>{$_('layout.exportSettingsToAccount')}</span>
</button>

<div class="space"></div>
<button class="surface-container-highest" onclick={() => transferSettings('import')}>
	<i>file_download</i>
	<span>{$_('layout.importSettingsFromAccount')}</span>
</button>
{#if settingsTransferMessage}
	<p class:error-text={settingsTransferError} role="status">{settingsTransferMessage}</p>
{/if}

<div class="space"></div>
<div class="divider"></div>
<div class="space"></div>

{#if showDeleteAccount}
	<form onsubmit={deleteAccount}>
		<p>{$_('layout.deleteAccountConfirm')}</p>
		<div class="field label prefix surface-container-highest">
			<i>password</i>
			<input
				id="delete-account-password"
				type="password"
				autocomplete="current-password"
				bind:value={deletePassword}
				placeholder=" "
				required
				disabled={isDeleting}
			/>
			<label for="delete-account-password">{$_('layout.currentPassword')}</label>
		</div>
		{#if deleteFailed}
			<p class="error-text" role="alert">{$_('layout.deleteAccountFailed')}</p>
		{/if}
		<nav>
			<button
				type="submit"
				class="tertiary"
				disabled={isDeleting || !deletePassword || !derivePassword}
			>
				{#if isDeleting}<progress class="circle indeterminate small"></progress>{/if}
				<i>warning</i>
				<span>{$_('layout.deleteAccount')}</span>
			</button>
			<button type="button" class="secondary" disabled={isDeleting} onclick={cancelDeleteAccount}>
				{$_('cancel')}
			</button>
		</nav>
	</form>
{:else}
	<button
		class="tertiary"
		onclick={() => {
			showDeleteAccount = true;
		}}
	>
		<i>warning</i>
		<span>{$_('layout.deleteAccount')}</span>
	</button>
{/if}

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
