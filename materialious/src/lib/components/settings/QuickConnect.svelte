<script lang="ts">
	import { _ } from '$lib/i18n';
	import { onDestroy } from 'svelte';
	import {
		cancelQuickConnectSession,
		createQuickConnectSession,
		getQuickConnectStatus,
		sendQuickConnectCredentials
	} from '$lib/api/backend/quickconnect';
	import { addToast } from '$lib/components/Toast.svelte';

	let phase = $state<'idle' | 'showing' | 'awaiting-send' | 'sent' | 'error'>('idle');
	let errorMessage = $state('');

	let code = $state('');
	let expiresAt = $state(0);
	let receiverPublicKey = $state<string | null>(null);
	let now = $state(Date.now());

	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let clockTimer: ReturnType<typeof setInterval> | undefined;

	const remainingSeconds = $derived(Math.max(0, Math.ceil((expiresAt - now) / 1000)));

	async function generate() {
		const session = await createQuickConnectSession();
		if (!session) {
			errorMessage = $_('quickConnect.generateFailed');
			phase = 'error';
			return;
		}

		code = session.code;
		expiresAt = new Date(session.expires).getTime();
		receiverPublicKey = null;
		errorMessage = '';
		phase = 'showing';

		startClock();
		startPolling();
	}

	async function poll() {
		if (!code) return;

		if (Date.now() > expiresAt) {
			await cancel();
			errorMessage = $_('quickConnect.expired');
			phase = 'error';
			return;
		}

		const status = await getQuickConnectStatus(code);
		if (!status) {
			await cancel();
			errorMessage = $_('quickConnect.expired');
			phase = 'error';
			return;
		}

		if (status.status === 'completed') {
			stopPolling();
			phase = 'sent';
			return;
		}

		if (status.receiverPublicKey) {
			receiverPublicKey = status.receiverPublicKey;
			phase = 'awaiting-send';
		}
	}

	async function send() {
		if (!code || !receiverPublicKey) return;

		const success = await sendQuickConnectCredentials(code, receiverPublicKey);
		if (!success) {
			errorMessage = $_('quickConnect.sendFailed');
			phase = 'error';
			return;
		}

		await poll();
		if (phase === 'awaiting-send') phase = 'sent';

		addToast({
			data: {
				text: $_('quickConnect.sent')
			}
		});
	}

	async function cancel() {
		stopPolling();
		stopClock();
		if (code) await cancelQuickConnectSession(code);
		code = '';
		receiverPublicKey = null;
		phase = 'idle';
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

	function startClock() {
		stopClock();
		now = Date.now();
		clockTimer = setInterval(() => {
			now = Date.now();
		}, 1000);
	}

	function stopClock() {
		if (clockTimer) {
			clearInterval(clockTimer);
			clockTimer = undefined;
		}
	}

	onDestroy(() => {
		stopPolling();
		stopClock();
	});
</script>

{#if phase === 'idle' || phase === 'error'}
	<nav class="no-space">
		<button class="secondary" onclick={generate}>
			<i>devices</i>
			<span>{$_('quickConnect.generate')}</span>
		</button>
		{#if phase === 'error'}
			<p class="error-text small-text">{errorMessage}</p>
		{/if}
	</nav>
{:else}
	<div class="quick-connect">
		<div class="space"></div>
		{#if phase === 'showing' || phase === 'awaiting-send'}
			<div class="pin-input">
				{#each code.split('') as char, index (index)}
					<span class="code-char">{char}</span>
				{/each}
			</div>

			<p class="small-text no-margin">
				{$_(
					phase === 'awaiting-send'
						? 'quickConnect.deviceConnected'
						: 'quickConnect.waitingForDevice'
				)}
			</p>

			<p class="small-text no-margin">
				{$_('quickConnect.expiresIn', { seconds: remainingSeconds })}
			</p>

			<nav class="no-space no-margin" style="gap: 1em;">
				{#if phase === 'awaiting-send'}
					<button class="primary" onclick={send}>
						<i>send</i>
						<span>{$_('quickConnect.send')}</span>
					</button>
				{/if}
				<button class="secondary" type="button" onclick={cancel}>
					{$_('cancel')}
				</button>
			</nav>
		{:else if phase === 'sent'}
			<nav class="horizontal no-margin">
				<i class="primary-text">check_circle</i>
				<span>{$_('quickConnect.sent')}</span>
			</nav>
			<nav class="no-space">
				<button class="secondary" type="button" onclick={() => void cancel()}>
					{$_('quickConnect.done')}
				</button>
			</nav>
		{/if}
	</div>
{/if}

<style>
	.quick-connect {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}

	.pin-input {
		display: flex;
		gap: 0.5rem;
		width: 100%;
	}

	.code-char {
		flex: 1 1 0;
		min-width: 0;
		max-width: 3rem;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-family: monospace;
		border: 0.0625rem solid var(--outline-variant);
		border-radius: var(--border-radius);
		background-color: var(--surface-container-highest);
		color: var(--on-surface);
	}

	.error-text {
		color: var(--error);
	}
</style>
