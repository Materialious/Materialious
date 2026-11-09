<script lang="ts">
	import { videoLength } from '#lib/numbers';
	import Fuse from 'fuse.js';
	import { parseResponse } from 'media-captions';
	import { transcriptLines, type TranscriptLine } from '#lib/player/transcript';
	import { subtitleSettings } from '#lib/store';
	import { _ } from '#lib/i18n/index';
	import type { VideoPlay } from '#lib/api/model';
	import { getCaptionUrls, fetchCaption } from '#lib/player/captions';
	import ComboBox from '#lib/components/ComboBox.svelte';

	interface Props {
		video: VideoPlay;
		playerElement?: HTMLMediaElement;
		onSeek: (time: number) => void;
	}

	let { video, playerElement, onSeek }: Props = $props();
	let currentTime = $state(0);
	const captionTime = $derived(currentTime - ($subtitleSettings.offset ?? 0));
	let cues: TranscriptLine[] = $state.raw([]);
	let isLoading = $state(false);
	let hasError = $state(false);
	let hasTranscript = $state(false);
	let autoScroll = $state(true);
	let search = $state('');
	let scrollable: HTMLElement;
	let requestId = 0;

	const captionOptions = $derived(
		[{ label: $_('selectLang'), value: '' }].concat(
			video.captions.map((c, i) => ({ label: c.label, value: String(i) }))
		)
	);
	const searchIndex = $derived(new Fuse(cues, { keys: ['text'] }));
	const visibleCues = $derived.by(() => {
		if (!search.trim()) return cues;
		const matches = new Set(searchIndex.search(search.trim()).map((result) => result.item));
		return cues.filter((cue) => matches.has(cue));
	});
	const activeCue = $derived(
		visibleCues.find((cue) => captionTime >= cue.startTime && captionTime < cue.endTime)
	);

	$effect(() => {
		if (!autoScroll || !activeCue || !scrollable) return;
		const line = scrollable.querySelector<HTMLElement>('[aria-current="true"]');
		if (line) {
			const top =
				line.getBoundingClientRect().top -
				scrollable.getBoundingClientRect().top +
				scrollable.scrollTop -
				scrollable.clientTop;
			if (
				top < scrollable.scrollTop ||
				top + line.offsetHeight > scrollable.scrollTop + scrollable.clientHeight
			) {
				scrollable.scrollTop = top - scrollable.clientHeight / 2 + line.offsetHeight / 2;
			}
		}
	});

	$effect(() => {
		const element = playerElement;
		if (!element) return;
		let frame = 0;
		const update = () => {
			currentTime = element.currentTime;
		};
		const tick = () => {
			update();
			frame = requestAnimationFrame(tick);
		};
		const start = () => {
			cancelAnimationFrame(frame);
			tick();
		};
		const stop = () => {
			cancelAnimationFrame(frame);
			update();
		};
		element.addEventListener('play', start);
		element.addEventListener('pause', stop);
		element.addEventListener('ended', stop);
		element.addEventListener('seeking', update);
		element.addEventListener('seeked', update);
		if (element.paused) update();
		else start();
		return () => {
			cancelAnimationFrame(frame);
			element.removeEventListener('play', start);
			element.removeEventListener('pause', stop);
			element.removeEventListener('ended', stop);
			element.removeEventListener('seeking', update);
			element.removeEventListener('seeked', update);
		};
	});

	async function onCaptionChange(value: string) {
		const id = ++requestId;
		const caption = value === '' ? undefined : video.captions[Number(value)];
		cues = [];
		search = '';
		hasTranscript = false;
		hasError = false;
		isLoading = !!caption;
		if (!caption) return;

		try {
			const response = await fetchCaption(getCaptionUrls(caption, video.fallbackPatch));
			if (!response) throw new Error('Caption fetch failed');
			const transcript = await parseResponse(response);
			if (id !== requestId) return;
			cues = transcriptLines(transcript.cues);
			hasTranscript = true;
		} catch {
			if (id === requestId) hasError = true;
		} finally {
			if (id === requestId) isLoading = false;
		}
	}
</script>

<article class="border no-padding transcript-panel">
	<div class="padding transcript-controls">
		<h6>{$_('transcript')}</h6>
		<ComboBox options={captionOptions} label={$_('language')} onChange={onCaptionChange} />
		{#if hasTranscript && cues.length > 0}
			<div class="small-space"></div>
			<div class="field prefix small round no-margin surface-container-highest">
				<i class="front">search</i>
				<input
					bind:value={search}
					type="search"
					aria-label={$_('searchPlaceholder')}
					placeholder={$_('searchPlaceholder')}
				/>
			</div>
			<div class="small-space"></div>
			<label class="checkbox">
				<input bind:checked={autoScroll} type="checkbox" />
				<span>{$_('transcriptAutoScroll')}</span>
			</label>
		{/if}
	</div>
	<div class="divider"></div>
	<div
		class="scroll transcript-list"
		role="region"
		aria-label={$_('transcript')}
		bind:this={scrollable}
	>
		{#if isLoading}
			<nav class="center-align padding">
				<progress class="circle" aria-label={$_('transcriptLoading')}></progress>
			</nav>
		{:else if hasError}
			<p class="padding" role="alert">{$_('transcriptLoadError')}</p>
		{:else if hasTranscript}
			{#if cues.length === 0}
				<p class="padding">{$_('noCaptionData')}</p>
			{:else if visibleCues.length === 0}
				<p class="padding">{$_('noResult')}</p>
			{:else}
				{#each visibleCues as item (item)}
					{@const isCurrent = captionTime >= item.startTime && captionTime < item.endTime}
					<button
						type="button"
						class="transcript-line"
						class:surface-container-highest={isCurrent}
						aria-current={isCurrent ? 'true' : undefined}
						onclick={() => onSeek(Math.max(0, item.startTime + ($subtitleSettings.offset ?? 0)))}
					>
						<span class="transcript-time"
							>{videoLength(Math.max(0, item.startTime + ($subtitleSettings.offset ?? 0)))}</span
						>
						<span class="transcript-text">{item.text}</span>
					</button>
				{/each}
			{/if}
		{/if}
	</div>
</article>

<style>
	.transcript-panel {
		display: flex;
		flex-direction: column;
		max-height: min(75vh, 48rem);
	}
	.transcript-controls {
		flex: none;
	}
	.transcript-list {
		min-height: 4rem;
		overflow-y: auto;
		position: relative;
	}
	.transcript-line {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 1rem;
		width: 100%;
		height: auto;
		min-height: 0;
		padding: 0.75rem 1rem;
		margin: 0;
		border-radius: 0;
		background: var(--surface-container-low);
		color: inherit;
		text-align: left;
		white-space: normal;
	}
	.transcript-line.surface-container-highest {
		background: var(--surface-container-highest);
	}
	.transcript-line:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: -2px;
	}
	.transcript-time {
		font-variant-numeric: tabular-nums;
	}
	.transcript-text {
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
</style>
