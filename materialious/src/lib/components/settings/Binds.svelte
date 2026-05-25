<script lang="ts">
	import { _ } from '$lib/i18n';
	import { keybindStore, defaultKeybinds, type Keybinds } from '$lib/store';

	let binds = $state<Keybinds>({ ...$keybindStore });
	let recording: keyof Keybinds | null = $state(null);

	function startRecording(action: keyof Keybinds) {
		recording = action;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (!recording) return;

		e.preventDefault();
		e.stopPropagation();

		const parts: string[] = [];
		if (e.ctrlKey) parts.push('ctrl');
		if (e.altKey) parts.push('alt');
		if (e.shiftKey) parts.push('shift');
		if (e.metaKey) parts.push('command');

		const key = e.key;
		if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
			const mapped = key === ' ' ? 'space' : key.toLowerCase();
			parts.push(mapped);
		}

		if (parts.length > 0) {
			const combo = parts.join('+');
			binds[recording] = combo;
			keybindStore.set({ ...binds });
			recording = null;
		}
	}

	function resetDefaults() {
		binds = { ...defaultKeybinds };
		keybindStore.set({ ...defaultKeybinds });
	}

	const actions: { key: keyof Keybinds; label: string }[] = [
		{ key: 'togglePlay', label: $_('layout.binds.togglePlay') },
		{ key: 'skipSponsor', label: $_('layout.binds.skipSponsor') },
		{ key: 'toggleSubtitles', label: $_('layout.binds.toggleSubtitles') },
		{ key: 'toggleFullscreen', label: $_('layout.binds.toggleFullscreen') },
		{ key: 'speedDown', label: $_('layout.binds.speedDown') },
		{ key: 'speedUp', label: $_('layout.binds.speedUp') },
		{ key: 'frameBack', label: $_('layout.binds.frameBack') },
		{ key: 'frameForward', label: $_('layout.binds.frameForward') },
		{ key: 'seekBack', label: $_('layout.binds.seekBack') },
		{ key: 'seekForward', label: $_('layout.binds.seekForward') },
		{ key: 'search', label: $_('layout.binds.search') }
	];
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="space"></div>

{#each actions as { key, label } (key)}
	<nav class="no-padding">
		<div class="max">
			<p>{label}</p>
		</div>
		<button
			class="chip"
			class:primary={recording === key}
			onclick={() => startRecording(key)}
			style="min-width: 8em; justify-content: center;"
		>
			{recording === key ? $_('layout.binds.clickToSet') : binds[key]}
		</button>
	</nav>
{/each}

<div class="space"></div>

<nav class="wrap">
	<button class="secondary max" onclick={resetDefaults}>
		<i>restart_alt</i>
		<span>{$_('layout.binds.reset')}</span>
	</button>
</nav>
