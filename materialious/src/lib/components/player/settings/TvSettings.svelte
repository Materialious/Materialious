<script lang="ts">
	import type shaka from 'shaka-player/dist/shaka-player.ui';
	import { getNextFocus } from '@bbc/tv-lrud-spatial';
	import { keyCodeMap } from '#lib/utils';
	import { _ } from '#lib/i18n/index';
	import { playbackRates } from '#lib/player/index';
	import { activeCaptionTrack } from '#lib/store';
	import { selectTextTrack, setTextTrackVisibility } from '../ClosedCaptions.svelte';
	import type { VideoPlay } from '#lib/api/model';
	import { tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let {
		player,
		playerElement,
		video
	}: {
		player: shaka.Player;
		playerElement: HTMLMediaElement;
		video: VideoPlay;
	} = $props();

	type View = 'root' | 'quality' | 'speed' | 'subtitles';

	let view = $state<View>('root');
	let panel: HTMLElement | undefined = $state();
	let playbackRate = $state(playerElement.playbackRate);
	let auto = $state(player.getConfiguration().abr.enabled);
	let activeTrack = $state(player.getVideoTracks().find((track) => track.active));

	// YouTube names a quality by its 16:9 tier: the short side for regular and vertical video,
	// or width * 9/16 for wider ones (a 1920x960 video is 1080p, not 960p). Some tracks also
	// report width and height swapped, which the short/long split makes irrelevant.
	const trackLabel = (track: shaka.extern.VideoTrack) => {
		const width = track.width || 0;
		const height = track.height || 0;
		if (!width || !height) return width || height;

		return Math.round(Math.max(Math.min(width, height), (Math.max(width, height) * 9) / 16));
	};

	// Tracks don't change mid-playback, so this is only read once on open.
	const videoTracks = (() => {
		const best = new SvelteMap<number, shaka.extern.VideoTrack>();
		for (const track of player.getVideoTracks()) {
			const label = trackLabel(track);
			const current = best.get(label);
			if (!current || track.bandwidth > current.bandwidth) best.set(label, track);
		}
		return [...best.entries()].sort((a, b) => b[0] - a[0]);
	})();

	const hasSubtitles = video.captions.length > 0 && !video.liveNow;

	const title = $derived(
		view === 'quality'
			? $_('player.controls.quality')
			: view === 'speed'
				? $_('player.controls.playbackSpeed')
				: view === 'subtitles'
					? $_('player.controls.subtitles')
					: $_('layout.settings')
	);

	const qualityValue = $derived(
		auto
			? `${$_('player.controls.auto')}${activeTrack ? ` · ${trackLabel(activeTrack)}p` : ''}`
			: activeTrack
				? `${trackLabel(activeTrack)}p`
				: $_('player.controls.auto')
	);

	const subtitlesValue = $derived(
		video.captions.find((track) => track.url === $activeCaptionTrack)?.label ??
			$_('player.controls.off')
	);

	// Shrinks the video into a card (see :global rules below) while the panel is open.
	$effect(() => {
		document.body.classList.add('tv-settings-open');
		return () => document.body.classList.remove('tv-settings-open');
	});

	function focusRow(selector: string) {
		tick().then(() => {
			const row =
				panel?.querySelector<HTMLElement>(selector) ?? panel?.querySelector<HTMLElement>('.row');
			row?.focus();
		});
	}

	function open(next: View) {
		view = next;
		focusRow('.row.selected');
	}

	// Returns true when it went up a level; false means the caller should close the panel.
	export function back(): boolean {
		if (view === 'root') return false;
		const previous = view;
		view = 'root';
		focusRow(`[data-view="${previous}"]`);
		return true;
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Enter activates the focused row natively; Esc/back is handled by the TV page.
		if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') return;

		const keyCode = keyCodeMap[event.key];
		if (!keyCode || !panel) return;

		// Left/Right have nowhere to go in a single column.
		event.preventDefault();
		const next = getNextFocus(document.activeElement, keyCode, panel);
		if (next instanceof HTMLElement) {
			next.focus();
			next.scrollIntoView({ block: 'center', inline: 'nearest' });
		}
	}

	function selectQuality(track: shaka.extern.VideoTrack | undefined) {
		if (track) {
			player.configure({ abr: { enabled: false } });
			player.selectVideoTrack(track, true);
			auto = false;
			activeTrack = track;
		} else {
			player.configure({ abr: { enabled: true } });
			auto = true;
			activeTrack = player.getVideoTracks().find((t) => t.active);
		}
		back();
	}

	function selectSpeed(rate: number) {
		playerElement.playbackRate = rate;
		playbackRate = rate;
		back();
	}

	function selectSubtitles(language: string | null) {
		if (language === null) setTextTrackVisibility(false);
		else selectTextTrack(language);
		back();
	}

	// Focus the first row when the panel opens.
	focusRow('.row');
</script>

<div class="tv-settings" bind:this={panel} role="dialog" tabindex="-1" onkeydown={handleKeyDown}>
	<div class="column">
		<h2>{title}</h2>

		<div class="list">
			{#if view === 'root'}
				<button class="row" data-view="quality" onclick={() => open('quality')}>
					<span class="text">
						<span>{$_('player.controls.quality')}</span>
						<span class="value">{qualityValue}</span>
					</span>
					<i>chevron_right</i>
				</button>
				<button class="row" data-view="speed" onclick={() => open('speed')}>
					<span class="text">
						<span>{$_('player.controls.playbackSpeed')}</span>
						<span class="value">{playbackRate}x</span>
					</span>
					<i>chevron_right</i>
				</button>
				{#if hasSubtitles}
					<button class="row" data-view="subtitles" onclick={() => open('subtitles')}>
						<span class="text">
							<span>{$_('player.controls.subtitles')}</span>
							<span class="value">{subtitlesValue}</span>
						</span>
						<i>chevron_right</i>
					</button>
				{/if}
			{:else if view === 'quality'}
				<button class="row" class:selected={auto} onclick={() => selectQuality(undefined)}>
					<span>{$_('player.controls.auto')}</span>
					{#if auto}<i>check</i>{/if}
				</button>
				{#each videoTracks as [label, track] (label)}
					<button
						class="row"
						class:selected={!auto && activeTrack && trackLabel(activeTrack) === label}
						onclick={() => selectQuality(track)}
					>
						<span>{label}p</span>
						{#if !auto && activeTrack && trackLabel(activeTrack) === label}<i>check</i>{/if}
					</button>
				{/each}
			{:else if view === 'speed'}
				{#each playbackRates as rate (rate)}
					<button
						class="row"
						class:selected={playbackRate === rate}
						onclick={() => selectSpeed(rate)}
					>
						<span>{rate}x</span>
						{#if playbackRate === rate}<i>check</i>{/if}
					</button>
				{/each}
			{:else if view === 'subtitles'}
				<button
					class="row"
					class:selected={$activeCaptionTrack === null}
					onclick={() => selectSubtitles(null)}
				>
					<span>{$_('player.controls.off')}</span>
					{#if $activeCaptionTrack === null}<i>check</i>{/if}
				</button>
				{#each video.captions as track (track)}
					<button
						class="row"
						class:selected={$activeCaptionTrack === track.url}
						onclick={() => selectSubtitles(track.url)}
					>
						<span>{track.label}</span>
						{#if $activeCaptionTrack === track.url}<i>check</i>{/if}
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.tv-settings {
		position: fixed;
		inset: 0;
		z-index: 102;
		background-color: var(--surface);
		color: var(--on-surface);
		/* 1u = 1px on a 1920-wide screen; keeps sizes independent of WebView density. */
		--u: calc(100vw / 1920);
	}

	.column {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 65.3vw;
		right: 2.8vw;
		display: flex;
		flex-direction: column;
		padding-top: calc(40 * var(--u));
	}

	h2 {
		margin: 0 0 calc(24 * var(--u));
		font-size: calc(32 * var(--u));
		font-weight: 700;
		line-height: 1.2;
	}

	.list {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: calc(12 * var(--u));
		padding-bottom: calc(40 * var(--u));
		overflow-y: auto;
		scrollbar-width: none;
	}

	.list::-webkit-scrollbar {
		display: none;
	}

	/* `all: unset` drops the global button theme so the rows match YouTube's plain list. */
	.row {
		all: unset;
		box-sizing: border-box;
		flex-shrink: 0;
		margin: 0 !important;
		line-height: 1.2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(16 * var(--u));
		min-height: calc(88 * var(--u));
		padding: 0 calc(24 * var(--u));
		border-radius: calc(16 * var(--u));
		background-color: var(--surface-container-high);
		color: var(--on-surface);
		font-size: calc(28 * var(--u));
		cursor: pointer;
	}

	.row:focus {
		background-color: var(--inverse-surface);
		color: var(--inverse-on-surface);
	}

	/* The global button theme paints a state layer here that dulls the focused row. */
	.row::before,
	.row::after {
		display: none;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: calc(4 * var(--u));
		min-width: 0;
		padding: calc(12 * var(--u)) 0;
	}

	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--on-surface-variant);
		font-size: calc(22 * var(--u));
	}

	.row:focus .value {
		color: inherit;
		opacity: 0.7;
	}

	/* The video becomes a card on the left, still playing, like YouTube TV. */
	:global(body.tv-settings-open #player-container) {
		position: fixed !important;
		z-index: 103;
		left: 2.8vw;
		top: 50%;
		width: 59.7vw !important;
		height: auto !important;
		--video-player-height: calc(59.7vw * 9 / 16);
		max-width: none !important;
		max-height: none !important;
		transform: translateY(-50%);
		border-radius: calc(24 * 100vw / 1920);
		overflow: hidden;
	}

	:global(body.tv-settings-open #player-container #player-controls),
	:global(body.tv-settings-open #player-container #mobile-time) {
		display: none;
	}
</style>
