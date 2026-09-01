<script lang="ts">
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '$lib/api/model';
	import { selectTextTrack, setTextTrackVisibility } from '../ClosedCaptions.svelte';
	import {
		subtitleSettings,
		defaultSubtitleSettings,
		activeCaptionTrack,
		type SubtitleSettings
	} from '$lib/store';

	let { video }: { video: VideoPlay } = $props();
	let dialog: HTMLDialogElement;
	let ccOpen = $state(false);
	let ccButton: HTMLButtonElement | undefined = $state();

	function onCCClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('menu')) return;
		ccOpen = !ccOpen;
		if (!ccOpen) {
			ccButton?.blur();
		}
	}

	function onCCBlur() {
		ccOpen = false;
	}

	const sizeOptions = [
		{ value: 1, label: 'XS' },
		{ value: 2, label: 'Small' },
		{ value: 3, label: 'Medium' },
		{ value: 4, label: 'Large' },
		{ value: 5, label: 'XL' },
		{ value: 6, label: 'XXL' }
	] as const;

	const alignmentOptions = [
		{ value: 'start', label: 'Left' },
		{ value: 'center', label: 'Center' },
		{ value: 'end', label: 'Right' }
	] as const;

	const textShadowOptions = [
		{ value: 'none', label: 'None' },
		{ value: '1px 1px 2px rgba(0,0,0,0.8)', label: 'Light' },
		{ value: '2px 2px 4px rgba(0,0,0,0.9)', label: 'Heavy' }
	] as const;

	const colorPresets = ['#ffffff', '#ffeb3b', '#00e5ff', '#76ff03', '#ff4081', '#ff9100'] as const;

	const backgroundPresets = [
		'rgba(0, 0, 0, 0.8)',
		'rgba(0, 0, 0, 0)',
		'rgba(30, 30, 30, 0.85)',
		'rgba(0, 0, 80, 0.8)',
		'rgba(0, 100, 0, 0.7)'
	] as const;

	function parseRgbColor(color: string, opacity: number): string {
		if (color.startsWith('#')) {
			// Convert hex -> rgba so opacity applies
			const clean = color.replace('#', '');
			const r = parseInt(clean.slice(0, 2), 16);
			const g = parseInt(clean.slice(2, 4), 16);
			const b = parseInt(clean.slice(4, 6), 16);
			return `rgba(${r}, ${g}, ${b}, ${opacity})`;
		}
		const match = color.match(/[\d.]+/g);
		if (!match || match.length < 3) return color;
		return `rgba(${match[0]}, ${match[1]}, ${match[2]}, ${opacity})`;
	}

	let fontSize = $state($subtitleSettings.fontSize);
	let color = $state($subtitleSettings.color);
	let backgroundColor = $state($subtitleSettings.backgroundColor);
	let backgroundColorBase = $state('#000000');
	let backgroundOpacity = $state($subtitleSettings.backgroundOpacity ?? 0.8);
	let textShadow = $state($subtitleSettings.textShadow);
	let alignment = $state<SubtitleSettings['alignment']>($subtitleSettings.alignment ?? 'center');
	let offset = $state($subtitleSettings.offset ?? 0);

	// Extract the RGB base hex from a persisted rgba/hex background color.
	function rgbBaseOf(bg: string): string {
		if (bg.startsWith('#')) return bg;
		const match = bg.match(/[\d.]+/g);
		if (!match || match.length < 3) return '#000000';
		const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
		return `#${toHex(Number(match[0]))}${toHex(Number(match[1]))}${toHex(Number(match[2]))}`;
	}

	function applyBackground() {
		backgroundColor = parseRgbColor(backgroundColorBase, backgroundOpacity);
	}

	function selectBackgroundBase(base: string) {
		backgroundColorBase = rgbBaseOf(base);
		applyBackground();
	}

	$effect(() => {
		subtitleSettings.update((s) => ({
			...s,
			fontSize,
			color,
			backgroundColor,
			textShadow,
			alignment,
			offset,
			backgroundOpacity
		}));
	});

	function openDialog() {
		fontSize = $subtitleSettings.fontSize;
		color = $subtitleSettings.color;
		backgroundColor = $subtitleSettings.backgroundColor;
		backgroundColorBase = rgbBaseOf($subtitleSettings.backgroundColor);
		backgroundOpacity = $subtitleSettings.backgroundOpacity ?? 0.8;
		textShadow = $subtitleSettings.textShadow;
		alignment = $subtitleSettings.alignment ?? 'center';
		offset = $subtitleSettings.offset ?? 0;
		dialog.showModal();
	}
</script>

{#if video.captions.length > 0 && !video.liveNow}
	<button
		bind:this={ccButton}
		class="surface-container-highest"
		class:primary={$activeCaptionTrack !== null}
		onclick={onCCClick}
		onblur={onCCBlur}
	>
		<i>closed_caption</i>
		<menu class="no-wrap mobile player-settings" id="cc-menu" data-ui="#cc-menu">
			<li
				role="presentation"
				data-ui="#cc-menu"
				class:selected={$activeCaptionTrack === null}
				onclick={() => {
					setTextTrackVisibility(false);
				}}
			>
				<i>closed_caption_off</i>
				{$_('player.controls.off')}
			</li>
			{#each video.captions as track (track)}
				<li
					role="presentation"
					data-ui="#cc-menu"
					class:selected={$activeCaptionTrack === track.language_code}
					onclick={() => {
						selectTextTrack(track.language_code);
					}}
				>
					<i>subtitles</i>
					{track.label}
				</li>
			{/each}
			<hr class="divider" />
			<li role="presentation" data-ui="#cc-menu" onclick={openDialog}>
				<nav class="no-wrap" style="width: 100%;">
					<i>tune</i>
					{$_('layout.customize')}
				</nav>
			</li>
		</menu>
	</button>
{/if}

<dialog
	bind:this={dialog}
	class="surface-container cc-dialog"
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<div class="cc-dialog-inner">
		<nav class="no-wrap cc-dialog-head">
			<h6 class="max no-margin">{$_('layout.customize')}</h6>
			<button class="circle transparent" onclick={() => dialog.close()}><i>close</i></button>
		</nav>

		<div class="cc-preview">
			<span
				class="cc-preview-text"
				style="color: {color};background: {backgroundColor};font-size: {14 +
					fontSize * 2}px;text-shadow: {textShadow};"
			>
				&#11015; &nbsp; Hello, welcome to Materialious
			</span>
		</div>

		<nav class="vertical" style="gap: 16px;">
			<div>
				<span class="no-margin cc-label">{$_('player.controls.fontSize')}</span>
				<nav class="no-wrap cc-segmented no-margin" style="gap: 4px;">
					{#each sizeOptions as opt (opt)}
						<button
							class="small"
							class:primary={fontSize === opt.value}
							class:surface-container-highest={fontSize !== opt.value}
							onclick={() => (fontSize = opt.value)}>{opt.label}</button
						>
					{/each}
				</nav>
			</div>

			<div>
				<span class="no-margin cc-label">{$_('player.controls.alignment')}</span>
				<nav class="no-wrap cc-segmented no-margin" style="gap: 4px;">
					{#each alignmentOptions as opt (opt)}
						<button
							class="small"
							class:primary={alignment === opt.value}
							class:surface-container-highest={alignment !== opt.value}
							onclick={() => (alignment = opt.value)}>{opt.label}</button
						>
					{/each}
				</nav>
			</div>

			<div>
				<span class="no-margin cc-label">{$_('player.controls.textColor')}</span>
				<div class="cc-swatches">
					{#each colorPresets as presetColor (presetColor)}
						<button
							class="cc-swatch"
							class:primary={color === presetColor}
							style="background:{presetColor};border-radius:50%;"
							onclick={() => (color = presetColor)}
							title={presetColor}
						></button>
					{/each}
					<input
						type="color"
						class="cc-color-input"
						aria-label={$_('player.controls.textColor')}
						bind:value={color}
					/>
				</div>
			</div>

			<div>
				<span class="no-margin cc-label">{$_('player.controls.bgColor')}</span>
				<div class="cc-swatches">
					{#each backgroundPresets as presetBg (presetBg)}
						<button
							class="cc-swatch"
							class:primary={rgbBaseOf(presetBg) === backgroundColorBase}
							style="background:{presetBg};border-radius:50%;"
							onclick={() => selectBackgroundBase(presetBg)}
							title={presetBg}
						></button>
					{/each}
					<input
						type="color"
						class="cc-color-input"
						aria-label={$_('player.controls.bgColor')}
						bind:value={backgroundColorBase}
						oninput={applyBackground}
					/>
				</div>
			</div>

			<div>
				<span class="no-margin cc-label">{$_('player.controls.opacity')}</span>
				<div class="slider small" style="--_start: 0%; --_end: {100 - backgroundOpacity * 100}%;">
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={backgroundOpacity}
						oninput={applyBackground}
					/>
				</div>
			</div>

			<div>
				<span class="no-margin cc-label">{$_('player.controls.textShadow')}</span>
				<nav class="no-wrap cc-segmented no-margin" style="gap: 4px;">
					{#each textShadowOptions as opt (opt)}
						<button
							class="small"
							class:primary={textShadow === opt.value}
							class:surface-container-highest={textShadow !== opt.value}
							onclick={() => (textShadow = opt.value)}>{opt.label}</button
						>
					{/each}
				</nav>
			</div>

			<div>
				<span class="no-margin cc-label">{$_('player.controls.subtitleOffset')}</span>
				<nav class="no-wrap no-margin" style="gap: 8px;align-items:center;">
					<button class="small surface-container-highest" onclick={() => (offset -= 0.5)}>
						<i>remove</i>
					</button>
					<span class="cc-offset-value">{offset.toFixed(1)}s</span>
					<button class="small surface-container-highest" onclick={() => (offset += 0.5)}>
						<i>add</i>
					</button>
					<button class="small border" onclick={() => (offset = 0)}
						>{$_('player.controls.auto')}</button
					>
				</nav>
			</div>

			<button
				class="small border"
				onclick={() => {
					fontSize = defaultSubtitleSettings.fontSize;
					color = defaultSubtitleSettings.color;
					backgroundColorBase = rgbBaseOf(defaultSubtitleSettings.backgroundColor);
					backgroundOpacity = defaultSubtitleSettings.backgroundOpacity;
					textShadow = defaultSubtitleSettings.textShadow;
					alignment = defaultSubtitleSettings.alignment ?? 'center';
					offset = defaultSubtitleSettings.offset;
					applyBackground();
				}}
			>
				<i>refresh</i>
				{$_('player.controls.reset')}
			</button>
		</nav>
	</div>
</dialog>

<style>
	.cc-dialog {
		width: min(400px, calc(100vw - 24px));
		border-radius: 16px;
		padding: 0;
		overflow: visible;
		border: none;
		max-width: calc(100vw - 24px);
	}

	@media (max-width: 360px) {
		.cc-dialog {
			width: 100vw;
			max-width: 100vw;
			height: 100dvh;
			max-height: 100dvh;
			min-inline-size: 100vw;
			margin: 0;
			inset: 0;
			transform: none;
			border-radius: 0;
		}

		.cc-dialog-inner {
			max-height: 100dvh;
		}
	}

	.cc-dialog-inner {
		padding: 20px;
		max-height: calc(100dvh - 48px);
		overflow-y: auto;
	}

	.cc-dialog-head {
		align-items: center;
		margin-bottom: 16px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--outline-variant);
	}

	.cc-preview {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 64px;
		border-radius: 12px;
		margin-bottom: 16px;
		background: #111;
	}

	.cc-preview-text {
		padding: 6px 12px;
		border-radius: 4px;
		display: inline-block;
		max-width: 90%;
		line-height: 1.3;
		text-align: center;
	}

	.cc-label {
		display: block;
		margin-bottom: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--on-surface);
	}

	.cc-segmented {
		flex-wrap: wrap;
	}

	.cc-segmented button.small {
		padding: 4px 10px;
		min-height: 0;
		border-radius: 8px;
	}

	.cc-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;
	}

	.cc-swatch {
		width: 28px;
		height: 28px;
		border: 2px solid var(--outline);
		cursor: pointer;
		display: inline-block;
		padding: 0 !important;
		flex: 0 0 auto;
	}

	.cc-swatch.primary {
		border-color: var(--primary);
	}

	.cc-color-input {
		width: 34px;
		height: 28px;
		border: 2px solid var(--outline);
		border-radius: 4px;
		padding: 0;
		cursor: pointer;
		flex: 0 0 auto;
	}

	.slider {
		width: 100%;
		margin-inline: 0;
		color: var(--primary);
		--active: color-mix(in srgb, var(--primary) 45%, transparent);
	}

	.cc-offset-value {
		min-width: 56px;
		text-align: center;
		font-weight: 600;
	}
</style>
