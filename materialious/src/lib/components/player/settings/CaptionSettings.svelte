<script lang="ts">
	import { _ } from '$lib/i18n';
	import type { VideoPlay } from '$lib/api/model';
	import { selectTextTrack, setTextTrackVisibility } from '../ClosedCaptions.svelte';
	import { subtitleSettings, defaultSubtitleSettings } from '$lib/store';

	let { video }: { video: VideoPlay } = $props();
	let dialog: HTMLDialogElement;

	const sizeOptions = [
		{ value: 2, label: 'Small' },
		{ value: 3, label: 'Medium' },
		{ value: 4, label: 'Large' },
		{ value: 5, label: 'XL' }
	] as const;

	let fontSize = $state($subtitleSettings.fontSize);
	let color = $state($subtitleSettings.color);
	let backgroundColor = $state($subtitleSettings.backgroundColor);
	let textShadow = $state($subtitleSettings.textShadow);
	const textShadowOptions = [
		{ value: 'none', label: 'None' },
		{ value: '1px 1px 2px rgba(0,0,0,0.8)', label: 'Light' },
		{ value: '2px 2px 4px rgba(0,0,0,0.9)', label: 'Heavy' }
	] as const;

	const presets = [
		{
			color: '#ffffff',
			backgroundColor: 'rgba(0, 0, 0, 0.8)',
			textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
			label: 'White / Black'
		},
		{
			color: '#ffeb3b',
			backgroundColor: 'rgba(0, 0, 0, 0.8)',
			textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
			label: 'Yellow / Black'
		},
		{
			color: '#ffffff',
			backgroundColor: 'rgba(0, 0, 0, 0)',
			textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
			label: 'White / Transparent'
		},
		{
			color: '#ffeb3b',
			backgroundColor: 'rgba(30, 30, 30, 0.85)',
			textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
			label: 'Yellow / Dark'
		},
		{
			color: '#ffffff',
			backgroundColor: 'rgba(0, 0, 80, 0.8)',
			textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
			label: 'White / Navy'
		},
		{
			color: '#ffffff',
			backgroundColor: 'rgba(0, 100, 0, 0.7)',
			textShadow: '2px 2px 2px rgba(0,0,0,0.8)',
			label: 'White / Green'
		}
	];

	function selectPreset(preset: (typeof presets)[number]) {
		color = preset.color;
		backgroundColor = preset.backgroundColor;
		textShadow = preset.textShadow;
	}

	function openDialog() {
		fontSize = $subtitleSettings.fontSize;
		color = $subtitleSettings.color;
		backgroundColor = $subtitleSettings.backgroundColor;
		textShadow = $subtitleSettings.textShadow;
		dialog.showModal();
	}

	$effect(() => {
		subtitleSettings.update((s) => ({ ...s, fontSize, color, backgroundColor, textShadow }));
	});
</script>

{#if video.captions.length > 0 && !video.liveNow}
	<button class="surface-container-highest">
		<i>closed_caption</i>
		<menu class="no-wrap mobile player-settings" id="cc-menu" data-ui="#cc-menu">
			<li role="presentation" data-ui="#cc-menu" onclick={() => setTextTrackVisibility(false)}>
				{$_('player.controls.off')}
			</li>
			{#each video.captions as track (track)}
				<li
					role="presentation"
					data-ui="#cc-menu"
					onclick={() => {
						selectTextTrack(track.language_code);
						setTextTrackVisibility(true);
					}}
				>
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
	class="surface-container"
	style="width: 360px;border-radius: 16px;padding: 0;overflow: visible;"
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<div style="padding: 20px;">
		<nav class="no-wrap" style="margin-bottom: 16px;">
			<h6 class="max no-margin">{$_('layout.customize')}</h6>
			<button class="circle transparent" onclick={() => dialog.close()}><i>close</i></button>
		</nav>

		<div
			style="display:flex;align-items:center;justify-content:center;min-height:64px;border-radius:12px;margin-bottom:16px;background: #111;"
		>
			<span
				style="color: {color};background: {backgroundColor};font-size: {14 +
					fontSize *
						2}px;padding: 6px 12px;border-radius: 4px;display: inline-block;max-width: 90%;line-height: 1.3;text-align:center;text-shadow: {textShadow};"
			>
				&#11015; &nbsp; Hello, welcome to Materialious
			</span>
		</div>

		<nav class="vertical" style="gap: 14px;">
			<div>
				<span class="no-margin" style="display:block;margin-bottom: 6px;font-size:0.75rem;"
					>{$_('player.controls.fontSize')}</span
				>
				<nav class="no-wrap" style="gap: 4px;">
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
				<span class="no-margin" style="display:block;margin-bottom: 6px;font-size:0.75rem;"
					>{$_('player.controls.textColor')}</span
				>
				<div class="wrap" style="display:flex;flex-wrap:wrap;gap: 6px;">
					{#each presets as preset (preset)}
						<button
							class:primary={color === preset.color && backgroundColor === preset.backgroundColor}
							class="surface-container-highest"
							style="flex:1;min-width:70px;padding:4px 6px;border-radius:8px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid {color ===
								preset.color && backgroundColor === preset.backgroundColor
								? 'var(--primary)'
								: 'var(--outline)'};"
							onclick={() => selectPreset(preset)}
							title={preset.label}
						>
							<span
								style="color:{preset.color};background:{preset.backgroundColor};padding:4px 10px;border-radius:4px;font-size:13px;font-weight:500;width:100%;text-align:center;"
								>Aa</span
							>
							<span style="font-size:0.625rem;line-height:1;white-space:nowrap;">{preset.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<div>
				<span class="no-margin" style="display:block;font-size:0.75rem;">Text shadow</span>
				<nav class="no-wrap" style="gap: 4px;">
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

			<button
				class="small border"
				onclick={() => {
					fontSize = defaultSubtitleSettings.fontSize;
					color = defaultSubtitleSettings.color;
					backgroundColor = defaultSubtitleSettings.backgroundColor;
					textShadow = defaultSubtitleSettings.textShadow;
				}}
			>
				<i>refresh</i>
				{$_('player.controls.reset')}
			</button>
		</nav>
	</div>
</dialog>
