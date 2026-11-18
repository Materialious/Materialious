<script lang="ts">
	import { onMount } from 'svelte';
	import { fromAction } from 'svelte/attachments';
	import { qr } from '@svelte-put/qr/svg';
	import { Clipboard } from '@capacitor/clipboard';
	import { addToast } from '#lib/components/Toast.svelte';
	import { _ } from '#lib/i18n/index';
	import type { DerivePassword } from '#lib/api/backend/index';
	import {
		getTwoFactorStatus,
		cancelTwoFactorSetup,
		changeTwoFactor,
		confirmTwoFactor,
		type TwoFactorStatus
	} from '#lib/api/backend/twoFactor';

	let { derivePassword }: { derivePassword: DerivePassword } = $props();
	let status = $state<TwoFactorStatus>();
	let password = $state('');
	let token = $state('');
	let busy = $state(false);
	let message = $state('');
	let action = $state<'POST' | 'DELETE' | null>(null);

	async function load() {
		busy = true;
		message = '';
		try {
			status = await getTwoFactorStatus();
		} catch {
			message = $_('twoFactor.failed');
		} finally {
			busy = false;
		}
	}
	onMount(() => {
		void load();
	});

	async function change(event: SubmitEvent) {
		event.preventDefault();
		if (busy || !action) return;
		busy = true;
		message = '';
		try {
			status = await changeTwoFactor(
				action,
				password,
				derivePassword,
				action === 'DELETE' ? token : undefined
			);
			action = null;
			token = '';
		} catch {
			message = $_('twoFactor.changeFailed');
		} finally {
			password = '';
			token = '';
			busy = false;
		}
	}

	async function cancelSetup() {
		if (busy) return;
		busy = true;
		message = '';
		try {
			status = await cancelTwoFactorSetup();
			token = '';
			password = '';
			action = null;
		} catch {
			message = $_('twoFactor.cancelFailed');
		} finally {
			busy = false;
		}
	}

	async function confirm(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		busy = true;
		message = '';
		try {
			await confirmTwoFactor(token);
			status = { configured: true, verified: true };
		} catch {
			message = $_('twoFactor.invalidCode');
		} finally {
			token = '';
			busy = false;
		}
	}

	async function copySecret() {
		if (!status?.secret) return;
		try {
			await Clipboard.write({ string: status.secret });
			message = '';
			addToast({ data: { text: $_('player.share.copiedSuccess') } });
		} catch {
			message = $_('twoFactor.copyFailed');
		}
	}
</script>

<h5 class="no-margin">{$_('twoFactor.title')}</h5>
{#if message}<p class="error-text" role="alert">{message}</p>{/if}
{#if !status}
	<button class="secondary" disabled={busy} onclick={load}>{$_('twoFactor.retry')}</button>
{:else if action}
	<form onsubmit={change}>
		<p>{$_('twoFactor.confirmPassword')}</p>
		<div class="field label prefix surface-container-highest">
			<i>password</i>
			<input
				id="two-factor-password"
				type="password"
				autocomplete="current-password"
				bind:value={password}
				placeholder=" "
				required
				disabled={busy}
			/>
			<label for="two-factor-password">{$_('layout.currentPassword')}</label>
		</div>
		{#if action === 'DELETE' && status.verified}
			<p>{$_('twoFactor.confirmDisable')}</p>
			<div class="field label prefix surface-container-highest">
				<i>security</i>
				<input
					id="disable-two-factor-code"
					type="text"
					bind:value={token}
					inputmode="numeric"
					autocomplete="one-time-code"
					pattern={'[0-9]{6}'}
					minlength="6"
					maxlength="6"
					placeholder=" "
					required
					disabled={busy}
				/>
				<label for="disable-two-factor-code">{$_('twoFactor.code')}</label>
			</div>
		{/if}
		<nav>
			<button
				type="submit"
				disabled={busy ||
					!password ||
					(action === 'DELETE' && status.verified && !/^[0-9]{6}$/.test(token))}
				>{$_(action === 'POST' ? 'twoFactor.enable' : 'twoFactor.remove')}</button
			>
			<button
				type="button"
				class="secondary"
				disabled={busy}
				onclick={() => {
					action = null;
					password = '';
					token = '';
					message = '';
				}}>{$_('cancel')}</button
			>
		</nav>
	</form>
{:else if status.verified}
	<p>{$_('twoFactor.enabled')}</p>
	<button
		class="secondary"
		disabled={busy}
		onclick={() => {
			action = 'DELETE';
		}}>{$_('twoFactor.disable')}</button
	>
{:else if status.secret && status.uri}
	<p>{$_('twoFactor.scan')}</p>
	<svg
		{@attach fromAction(qr, () => ({
			data: status?.uri ?? '',
			margin: 4,
			moduleFill: 'var(--primary)',
			anchorOuterFill: 'var(--primary)',
			anchorInnerFill: 'var(--primary)'
		}))}
		class="surface-container-lowest"
		width="240"
		height="240"
		role="img"
		aria-label={$_('twoFactor.qrLabel')}
		style="max-width: 100%; height: auto;"
	/>
	<p class="secret"><span>{$_('twoFactor.secret')}: </span><code>{status.secret}</code></p>
	<button class="secondary" type="button" onclick={copySecret}>{$_('twoFactor.copy')}</button>
	<p class="small-text">{$_('twoFactor.recoveryNotice')}</p>
	<form onsubmit={confirm}>
		<div class="field label prefix surface-container-highest">
			<i>security</i>
			<input
				id="setup-two-factor-code"
				type="text"
				bind:value={token}
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern={'[0-9]{6}'}
				minlength="6"
				maxlength="6"
				placeholder=" "
				required
				disabled={busy}
			/>
			<label for="setup-two-factor-code">{$_('twoFactor.code')}</label>
		</div>
		<nav>
			<button type="submit" disabled={busy || !/^[0-9]{6}$/.test(token)}
				>{$_('twoFactor.verify')}</button
			>
			<button type="button" class="secondary" disabled={busy} onclick={cancelSetup}
				>{$_('twoFactor.cancelSetup')}</button
			>
		</nav>
	</form>
{:else}
	<p>{$_('twoFactor.description')}</p>
	<p class="small-text">{$_('twoFactor.recoveryNotice')}</p>
	<button
		class="secondary"
		disabled={busy}
		onclick={() => {
			action = 'POST';
		}}>{$_('twoFactor.enable')}</button
	>
{/if}

<style>
	.secret {
		overflow-wrap: anywhere;
	}
</style>
