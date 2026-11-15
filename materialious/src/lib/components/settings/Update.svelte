<script lang="ts">
	import { getPublicEnv } from '#lib/env';
	import { tvUpdateState } from '#lib/stores/tvUpdate';
	import { tick } from 'svelte';
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { keyCodeMap } from '#lib/utils';

	let { promptMode = false }: { promptMode?: boolean } = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if ($tvUpdateState.prompt && !dialog.open) dialog.showModal();
		else if (!$tvUpdateState.prompt && dialog.open) dialog.close();
	});

	$effect(() => {
		const status = $tvUpdateState.status;
		if (!dialog || !$tvUpdateState.prompt) return;
		void tick().then(() => {
			if (!dialog?.open || !$tvUpdateState.prompt || $tvUpdateState.status !== status) return;
			if (status === 'available') {
				dialog.querySelector<HTMLButtonElement>('[data-update-install]')?.focus();
				return;
			}
			if (dialog.contains(document.activeElement) && document.activeElement !== dialog) return;
			dialog.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
		});
	});

	function dismiss() {
		tvUpdateState.update((state) => ({ ...state, prompt: false }));
	}

	function navigate(event: KeyboardEvent) {
		if (!dialog?.open || !$tvUpdateState.prompt) return;
		const keyCode = keyCodeMap[event.key];
		if (![37, 38, 39, 40].includes(keyCode)) return;

		event.preventDefault();
		event.stopPropagation();
		const active = document.activeElement;
		const current = active !== dialog && dialog.contains(active) ? active : null;
		getNextFocus(current, keyCode, dialog)?.focus();
	}

	async function check() {
		if (getPublicEnv('ANDROID_TV_BUILD') === 'true') {
			const updater = await import('#lib/android/tvUpdater');
			await updater.checkForTvUpdate($tvUpdateState.prompt);
		}
	}
	async function install() {
		if (getPublicEnv('ANDROID_TV_BUILD') === 'true') {
			const updater = await import('#lib/android/tvUpdater');
			await updater.installTvUpdate();
		}
	}
</script>

<svelte:window onkeydowncapture={navigate} />

{#snippet updateContent()}
	<article class="surface-container-low round">
		<h5>App update</h5>
		<p>Installed version: {getPublicEnv('APP_VERSION')}</p>
		{#if $tvUpdateState.status === 'idle'}
			<p>Check GitHub for a new Android TV release.</p>
		{:else if $tvUpdateState.status === 'checking'}
			<p role="status">Checking for updates…</p>
			<progress class="max" aria-label="Checking for updates"></progress>
		{:else if $tvUpdateState.status === 'current'}
			<p role="status">Materialious is up to date.</p>
		{:else if $tvUpdateState.status === 'available'}
			<p role="status">Version {$tvUpdateState.version} is available.</p>
		{:else if $tvUpdateState.status === 'downloading'}
			<p role="status">Downloading update: {Math.round($tvUpdateState.progress ?? 0)}%</p>
			<progress
				class="max"
				value={$tvUpdateState.progress ?? 0}
				max="100"
				aria-label="Downloading update"
			></progress>
		{:else if $tvUpdateState.status === 'installing'}
			<p role="status">Opening the Android installer…</p>
		{:else if $tvUpdateState.status === 'error'}
			<p class="error-text" role="alert">{$tvUpdateState.message}</p>
		{/if}
		<nav>
			{#if $tvUpdateState.status === 'available'}
				<button type="button" data-update-install onclick={install}
					><i>download</i><span>Download and install</span></button
				>
			{:else if ['idle', 'current', 'error'].includes($tvUpdateState.status)}
				<button type="button" onclick={check}><i>refresh</i><span>Check for updates</span></button>
			{/if}
		</nav>
	</article>
{/snippet}

{#if promptMode}
	<dialog bind:this={dialog} aria-label="Materialious update" oncancel={dismiss}>
		{@render updateContent()}
		<nav class="right-align">
			<button type="button" class="transparent" onclick={dismiss}>Later</button>
		</nav>
	</dialog>
{:else}
	{@render updateContent()}
{/if}
