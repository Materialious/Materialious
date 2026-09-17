<script lang="ts">
	import { _ } from '$lib/i18n';
	import { PinInput } from 'melt/builders';
	import { onDestroy } from 'svelte';
	import {
		cancelQuickConnectSession,
		fetchQuickConnectCredentials,
		getQuickConnectStatus,
		normalizeQuickConnectCode,
		openQuickConnectCredentials,
		registerQuickConnectReceiver,
		applyQuickConnectCredentials,
		type QuickConnectCredentials
	} from '$lib/api/backend/quickconnect';
	import { quickConnectTtlMs } from '$lib/api/backend/quickconnect';
	import { isAndroidTv } from '$lib/utils';

	interface Props {
		onConnected?: (credentials: QuickConnectCredentials) => void;
	}

	let { onConnected = () => {} }: Props = $props();

	let phase = $state<'entering' | 'connecting' | 'waiting' | 'success' | 'error'>('entering');
	let errorMessage = $state('');

	let code = $state('');
	let keypair: { publicKey: Uint8Array; privateKey: Uint8Array } | null = null;
	let deadline = $state(0);

	let tvInputEl = $state<HTMLInputElement | undefined>(undefined);

	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const pinInput = new PinInput({
		maxLength: 8,
		type: 'alphanumeric',
		onComplete: (value) => {
			void submit(normalizeQuickConnectCode(value));
		}
	});

	async function submit(enteredCode: string) {
		if (phase !== 'entering') return;

		code = enteredCode;
		phase = 'connecting';

		const status = await getQuickConnectStatus(code);
		if (!status) {
			showError($_('quickConnect.invalidCode'));
			return;
		}

		if (status.status === 'completed') {
			showError($_('quickConnect.alreadyUsed'));
			return;
		}

		keypair = await registerQuickConnectReceiver(code);
		if (!keypair) {
			showError($_('quickConnect.alreadyUsed'));
			return;
		}

		deadline = Date.now() + quickConnectTtlMs;
		phase = 'waiting';
		startPolling();
	}

	function showError(message: string) {
		errorMessage = message;
		phase = 'error';
	}

	function lockTvInput() {
		if (tvInputEl) tvInputEl.readOnly = true;
	}

	function unlockTvInput() {
		if (!tvInputEl) return;
		tvInputEl.readOnly = false;
		tvInputEl.focus();
	}

	function onTvKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;

		event.preventDefault();

		if (tvInputEl?.readOnly) {
			unlockTvInput();
			return;
		}

		const value = normalizeQuickConnectCode(tvInputEl?.value ?? '');
		if (value.length === 8) void submit(value);
	}

	function onTvInput(event: Event) {
		const el = event.target as HTMLInputElement;
		const normalized = normalizeQuickConnectCode(el.value).slice(0, 8);

		if (el.value !== normalized) el.value = normalized;
		if (normalized.length === 8) void submit(normalized);
	}

	function onTvClick() {
		if (tvInputEl?.readOnly) unlockTvInput();
	}

	async function poll() {
		if (!keypair) return;

		const cipher = await fetchQuickConnectCredentials(code);
		if (cipher) {
			const credentials = await openQuickConnectCredentials(
				cipher,
				keypair.publicKey,
				keypair.privateKey
			);
			if (credentials) {
				stopPolling();
				phase = 'success';
				applyQuickConnectCredentials(credentials);
				onConnected(credentials);
				return;
			}
		}

		if (Date.now() > deadline) {
			errorMessage = $_('quickConnect.expired');
			phase = 'error';
			stopPolling();
			return;
		}

		const status = await getQuickConnectStatus(code);
		if (!status || status.status === 'completed') {
			errorMessage = $_('quickConnect.expired');
			phase = 'error';
			stopPolling();
		}
	}

	function startPolling() {
		stopPolling();
		void poll();
		pollTimer = setInterval(() => void poll(), 2500);
	}

	function stopPolling() {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
	}

	function reset() {
		stopPolling();
		code = '';
		keypair = null;
		deadline = 0;
		errorMessage = '';
		pinInput.value = '';
		if (tvInputEl) tvInputEl.value = '';
		lockTvInput();
		phase = 'entering';
	}

	onDestroy(() => {
		stopPolling();
		if (code) cancelQuickConnectSession(code);
	});
</script>

<div class="space"></div>

<div class="center-align">
	{#if phase === 'entering' || phase === 'error'}
		<div class="pin-container">
			{#if isAndroidTv()}
				<input
					bind:this={tvInputEl}
					class="tv-code-input"
					type="text"
					inputmode="text"
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					maxlength="8"
					readonly
					placeholder={$_('quickConnect.tvPlaceholder')}
					onkeydown={onTvKeydown}
					oninput={onTvInput}
					onclick={onTvClick}
					onblur={lockTvInput}
				/>
			{:else}
				<div {...pinInput.root} class="pin-input">
					{#each pinInput.inputs as input, index (index)}
						<input {...input} />
					{/each}
				</div>
			{/if}

			{#if phase === 'error'}
				<p class="error-text">{errorMessage}</p>
			{/if}

			{#if phase === 'error'}
				<nav class="right-align no-space">
					<button class="secondary link" type="button" onclick={reset}>
						{$_('quickConnect.tryAgain')}
					</button>
				</nav>
			{/if}
		</div>
	{:else if phase === 'connecting'}
		<div class="status">
			<progress class="circle indeterminate small"></progress>
			<span>{$_('quickConnect.connecting')}</span>
		</div>
	{:else if phase === 'waiting'}
		<div class="status">
			<progress class="circle indeterminate small"></progress>
			<span>{$_('quickConnect.waiting')}</span>
		</div>
	{:else if phase === 'success'}
		<div class="status">
			<i class="primary-text">check_circle</i>
			<span>{$_('quickConnect.success')}</span>
		</div>
	{/if}
</div>

<style>
	.pin-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.status {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		text-align: center;
	}

	.status span {
		overflow-wrap: anywhere;
	}

	.pin-input {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		width: 100%;
	}

	.pin-input :global(input) {
		flex: 1 1 0;
		min-width: 0;
		max-width: 3rem;
		aspect-ratio: 1;
		text-align: center;
		font-size: 1.5rem;
		border: 0.0625rem solid var(--outline-variant);
		border-radius: var(--border-radius);
		background-color: var(--surface-container-highest);
		color: var(--on-surface);
		text-transform: uppercase;
	}

	.tv-code-input {
		width: 100%;
		height: 4rem;
		text-align: center;
		font-size: 2rem;
		font-family: monospace;
		letter-spacing: 0.5rem;
		text-transform: uppercase;
		border: 0.0625rem solid var(--outline-variant);
		border-radius: var(--border-radius);
		background-color: var(--surface-container-highest);
		color: var(--on-surface);
	}

	.tv-code-input::placeholder {
		font-size: 1rem;
		font-family: inherit;
		letter-spacing: normal;
		text-transform: none;
		color: var(--on-surface-variant);
	}

	.error-text {
		color: var(--error);
	}

	.success-text {
		color: var(--primary);
	}
</style>
