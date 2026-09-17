<script lang="ts">
	import { _ } from '$lib/i18n';
	import { PinInput } from 'melt/builders';
	import { onDestroy } from 'svelte';
	import { backendFetch } from '$lib/api/backend/request';
	import { isOwnBackend } from '$lib/shared';
	import { solveChallenge } from 'altcha-lib';
	import { deriveKey } from 'altcha-lib/algorithms/web/pbkdf2';
	import {
		cancelQuickConnectSession,
		fetchQuickConnectCredentials,
		getQuickConnectStatus,
		normalizeQuickConnectCode,
		openQuickConnectCredentials,
		registerQuickConnectReceiver,
		applyQuickConnectCredentials,
		type QuickConnectCredentials,
		type CaptchaPayload
	} from '$lib/api/backend/quickconnect';
	import { quickConnectTtlMs } from '$lib/api/backend/quickconnect';
	import { syncAuthTokenFromCloud } from '$lib/auth';
	import { isAndroidTv } from '$lib/utils';

	interface Props {
		onConnected?: (credentials: QuickConnectCredentials) => void;
		captchaPayload?: CaptchaPayload | null;
	}

	let { onConnected = () => {}, captchaPayload: providedCaptcha = null }: Props = $props();

	const captchaDisabled = $derived(!!isOwnBackend()?.captchaDisabled);

	let phase = $state<'entering' | 'connecting' | 'waiting' | 'success' | 'error'>('entering');
	let errorMessage = $state('');

	let code = $state('');
	let keypair: { publicKey: Uint8Array; privateKey: Uint8Array } | null = null;
	let deadline = $state(0);

	let tvInputEl = $state<HTMLInputElement | undefined>(undefined);

	let captchaPayload = $state<CaptchaPayload | null>(providedCaptcha);

	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let errorResetTimer: ReturnType<typeof setTimeout> | undefined;

	const pinInput = new PinInput({
		maxLength: 8,
		type: 'alphanumeric',
		onComplete: (value) => {
			void submit(normalizeQuickConnectCode(value));
		}
	});

	async function solveCaptchaChallenge(): Promise<boolean> {
		if (captchaDisabled) return true;

		try {
			const resp = await backendFetch('/api/captcha');
			const challenge = await resp.json();

			if (Object.keys(challenge).length === 0) return true;

			const solution = await solveChallenge({ challenge, deriveKey });
			if (!solution) return false;

			captchaPayload = {
				solution,
				challenge
			};
			return true;
		} catch {
			return false;
		}
	}

	async function ensureCaptcha(): Promise<boolean> {
		if (captchaDisabled || captchaPayload) return true;
		return await solveCaptchaChallenge();
	}

	async function submit(enteredCode: string) {
		if (phase !== 'entering') return;

		if (!(await ensureCaptcha())) {
			showError($_('captchaFailed'));
			return;
		}

		code = enteredCode;
		phase = 'connecting';

		const result = await registerQuickConnectReceiver(code, captchaPayload);
		if (result.status !== 'ok') {
			if (result.status === 'not-found' || result.status === 'error') {
				showError($_('quickConnect.invalidCode'));
			} else if (result.status === 'conflict') {
				showError($_('quickConnect.alreadyUsed'));
			} else {
				showError($_('captchaFailed'));
			}
			return;
		}

		keypair = result.keypair;
		deadline = Date.now() + quickConnectTtlMs;
		phase = 'waiting';
		startPolling();
	}

	function showError(message: string) {
		errorMessage = message;
		phase = 'error';
		clearTimeout(errorResetTimer);
		errorResetTimer = setTimeout(() => void reset(), 3000);
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
				await syncAuthTokenFromCloud();
				onConnected(credentials);
				return;
			}
		}

		if (Date.now() > deadline) {
			stopPolling();
			showError($_('quickConnect.expired'));
			return;
		}

		const status = await getQuickConnectStatus(code);
		if (!status || status.status === 'completed') {
			stopPolling();
			showError($_('quickConnect.expired'));
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
		clearTimeout(errorResetTimer);
		errorResetTimer = undefined;
		stopPolling();
		code = '';
		keypair = null;
		deadline = 0;
		errorMessage = '';
		pinInput.value = '';
		if (tvInputEl) tvInputEl.value = '';
		lockTvInput();
		phase = 'entering';
		captchaPayload = null;
	}

	onDestroy(() => {
		clearTimeout(errorResetTimer);
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

			<p class="small-text no-margin hint-text">{$_('quickConnect.codeLocation')}</p>

			{#if phase === 'error'}
				<p class="error-text">{errorMessage}</p>
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

	.hint-text {
		color: var(--on-surface-variant);
	}

	.success-text {
		color: var(--primary);
	}
</style>
