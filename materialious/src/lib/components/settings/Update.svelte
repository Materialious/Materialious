<script lang="ts">
	import { getPublicEnv } from '#lib/env';
	import { tvUpdateState } from '#lib/stores/tvUpdate';

	let { promptMode = false }: { promptMode?: boolean } = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if ($tvUpdateState.prompt && !dialog.open) dialog.showModal();
		else if (!$tvUpdateState.prompt && dialog.open) dialog.close();
	});

	function dismiss() {
		tvUpdateState.update((state) => ({ ...state, prompt: false }));
	}

	function navigate(event: KeyboardEvent) {
		if (!dialog || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
		const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
		if (buttons.length < 2) return;
		event.preventDefault();
		event.stopPropagation();
		const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
		buttons[
			(index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length
		]?.focus();
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
				<button type="button" onclick={install}
					><i>download</i><span>Download and install</span></button
				>
			{:else if ['idle', 'current', 'error'].includes($tvUpdateState.status)}
				<button type="button" onclick={check}><i>refresh</i><span>Check for updates</span></button>
			{/if}
		</nav>
	</article>
{/snippet}

{#if promptMode}
	<dialog
		bind:this={dialog}
		aria-label="Materialious update"
		oncancel={dismiss}
		onkeydown={navigate}
	>
		{@render updateContent()}
		<nav class="right-align">
			<button type="button" class="transparent" onclick={dismiss}>Later</button>
		</nav>
	</dialog>
{:else}
	{@render updateContent()}
{/if}
