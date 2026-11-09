<script lang="ts">
	import type { ParsedDescription } from '#lib/description';
	import type { Segment } from 'sponsorblock-api';
	import type { VideoPlay } from '#lib/api/model';
	import { _ } from '#lib/i18n/index';
	import { letterCase } from '#lib/letterCasing';
	import { videoLength } from '#lib/numbers';
	import { truncate } from '#lib/utils';
	import {
		invidiousInstanceStore,
		sponsorBlockTimelineStore,
		activeCaptionTrack
	} from '#lib/store';
	import {
		generateThumbnailWebVTT,
		drawTimelineThumbnail,
		storyboardThumbnails,
		type TimelineThumbnail
	} from '#lib/player/thumbnails';
	import { ImageCache } from '#lib/images';
	import { onDestroy, onMount } from 'svelte';
	import {
		selectTextTrack,
		setTextTrackVisibility,
		loadingCaptionTrack
	} from './ClosedCaptions.svelte';

	let {
		video,
		content,
		segments,
		playerElement,
		currentTime,
		userManualSeeking,
		visible,
		playlistPosition,
		hasNext,
		onPlayPause,
		onNext,
		onSettings,
		onInfo,
		rowElement = $bindable(),
		timelineElement = $bindable()
	}: {
		video: VideoPlay;
		content: ParsedDescription;
		segments: Segment[];
		playerElement: HTMLMediaElement | undefined;
		currentTime: number;
		userManualSeeking: boolean;
		visible: boolean;
		playlistPosition: string | undefined;
		hasNext: boolean;
		onPlayPause: () => void;
		onNext: () => void;
		onSettings: (opener: HTMLElement) => void;
		onInfo: (opener: HTMLElement) => void;
		rowElement: HTMLElement | undefined;
		timelineElement: HTMLElement | undefined;
	} = $props();

	let playing = $state(false);

	// Ticks every few seconds; only the clock/ends-at text nodes re-render.
	let now = $state(Date.now());
	let clockInterval: ReturnType<typeof setInterval>;

	const clock = $derived(
		new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
	);
	const endsAt = $derived(
		video.liveNow || !video.lengthSeconds
			? ''
			: new Date(now + (video.lengthSeconds - currentTime) * 1000).toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit'
				})
	);

	const hasCaptions = $derived(video.captions.length > 0 && !video.liveNow);
	const captionsOn = $derived($activeCaptionTrack !== null);
	// Quick toggle re-enables the last language the user picked; the full
	// language list stays in the settings panel.
	let lastCaptionLanguage: string | null = null;

	$effect(() => {
		if ($activeCaptionTrack !== null) lastCaptionLanguage = $activeCaptionTrack;
	});

	const currentChapter = $derived(
		content.timestamps.find((chapter, index) => {
			const endTime =
				index === content.timestamps.length - 1
					? video.lengthSeconds
					: content.timestamps[index + 1].time;
			return currentTime >= chapter.time && currentTime < endTime;
		})
	);

	function toggleCaptions() {
		if (captionsOn || $loadingCaptionTrack) setTextTrackVisibility(false);
		else void selectTextTrack(lastCaptionLanguage ?? '');
	}

	// Storyboard seek preview (same sources Timeline uses).
	let thumbnails: TimelineThumbnail[] = $state([]);
	let previewCanvas: HTMLCanvasElement | undefined = $state();
	const thumbnailCache = new ImageCache();

	onMount(() => {
		clockInterval = setInterval(() => (now = Date.now()), 5000);

		playerElement?.addEventListener('play', onPlay);
		playerElement?.addEventListener('pause', onPause);
		playerElement?.addEventListener('ended', onPause);
		playing = !!playerElement && !playerElement.paused;
	});

	function onPlay() {
		playing = true;
	}

	function onPause() {
		playing = false;
	}

	onMount(async () => {
		if (video.storyboards && video.storyboards.length > 2) {
			const selectedStoryboard = video.storyboards[2];
			let thumbnailVTT: string | undefined;

			if (
				video.fallbackPatch === 'youtubejs' &&
				typeof selectedStoryboard.rows !== 'undefined' &&
				typeof selectedStoryboard.columns !== 'undefined'
			) {
				thumbnailVTT = generateThumbnailWebVTT(
					{
						...selectedStoryboard,
						rows: selectedStoryboard.rows,
						columns: selectedStoryboard.columns
					},
					video.lengthSeconds
				);
			} else if (!video.fallbackPatch) {
				const thumbnailVTTResp = await fetch(`${$invidiousInstanceStore}${selectedStoryboard.url}`);
				if (thumbnailVTTResp.ok) thumbnailVTT = await thumbnailVTTResp.text();
			}

			if (thumbnailVTT) {
				storyboardThumbnails(thumbnailVTT)
					.then((storyboardThumbnails) => (thumbnails = storyboardThumbnails))
					.catch(() => {});
			}
		}
	});

	$effect(() => {
		if (!userManualSeeking || !previewCanvas || thumbnails.length === 0) return;

		const canvasContext = previewCanvas.getContext('2d');
		if (canvasContext)
			void drawTimelineThumbnail(canvasContext, thumbnailCache, thumbnails, currentTime);
	});

	onDestroy(() => {
		clearInterval(clockInterval);
		thumbnailCache.clear();
		playerElement?.removeEventListener('play', onPlay);
		playerElement?.removeEventListener('pause', onPause);
		playerElement?.removeEventListener('ended', onPause);
	});

	const markerGapSize = 0.1;
	const minVisiblePercent = 0.05;
	function timelineMarkerWidth(startTime: number, endTime: number): string {
		const ratio = (endTime - startTime) / video.lengthSeconds;
		if (ratio <= 0) return `0%`;

		let percent = ratio * 100;
		if (percent - markerGapSize >= minVisiblePercent) {
			percent = percent - markerGapSize;
		} else {
			percent = minVisiblePercent;
		}

		return `${percent}%`;
	}

	const previewPercent = $derived(
		video.lengthSeconds ? Math.min(Math.max((currentTime / video.lengthSeconds) * 100, 0), 100) : 0
	);

	const segmentCategoryColors: Record<string, { color: string; alt: string }> = {
		sponsor: { color: 'var(--error)', alt: 'var(--error-container)' },
		selfpromo: { color: 'var(--tertiary)', alt: 'var(--tertiary-container)' },
		interaction: { color: 'var(--primary)', alt: 'var(--primary-container)' },
		intro: { color: 'var(--secondary)', alt: 'var(--secondary-container)' },
		outro: { color: 'var(--tertiary-container)', alt: 'var(--tertiary)' },
		preview: { color: 'var(--secondary-container)', alt: 'var(--secondary)' },
		filler: { color: 'var(--outline)', alt: 'var(--outline-variant)' },
		music_offtopic: { color: 'var(--surface-variant)', alt: 'var(--outline-variant)' }
	};
</script>

<div class="tv-controls" class:visible>
	<div class="scrim top-scrim">
		<div class="top-right">
			{#if video.liveNow}
				<p class="no-margin tv-chip">{$_('thumbnail.live')}</p>
			{:else}
				<p class="no-margin tv-clock">{clock}</p>
				{#if endsAt}
					<p class="no-margin tv-clock-sub">{$_('player.controls.endsAt', { time: endsAt })}</p>
				{/if}
			{/if}
		</div>
	</div>

	<div class="scrim bottom-scrim">
		<div class="tv-title">
			<h4 class="no-margin">{letterCase(video.title)}</h4>
			<p class="no-margin tv-subtitle">
				{video.author}{playlistPosition ? ` · ${playlistPosition}` : ''}
			</p>
		</div>

		{#if userManualSeeking && !video.liveNow && video.lengthSeconds > 0}
			<div class="seek-preview" style:left="clamp(90px, {previewPercent}%, calc(100% - 90px))">
				{#if thumbnails.length > 0}
					<canvas
						bind:this={previewCanvas}
						width={thumbnails[0].width}
						height={thumbnails[0].height}
					></canvas>
				{/if}
				{#if currentChapter}
					<p class="no-margin seek-preview-chapter">{truncate(currentChapter.title, 30)}</p>
				{/if}
				<p class="no-margin seek-preview-time">{videoLength(currentTime)}</p>
			</div>
		{/if}

		{#if !video.liveNow && video.lengthSeconds > 0}
			<div
				class="tv-progress"
				role="slider"
				bind:this={timelineElement}
				tabindex="-1"
				aria-label={$_('player.controls.timeline')}
				aria-valuemin={0}
				aria-valuemax={video.lengthSeconds}
				aria-valuenow={Math.round(currentTime)}
				aria-valuetext={$_('player.controls.positionOf', {
					elapsed: videoLength(currentTime),
					total: videoLength(video.lengthSeconds)
				})}
			>
				<div class="track-line"></div>
				<div class="range" style:width="{(currentTime / video.lengthSeconds) * 100}%"></div>
				<div class="thumb" style:left="{previewPercent}%"></div>
				{#each content.timestamps as chapter, index (chapter)}
					<div
						class="chapter-marker"
						style:left="{(chapter.time / video.lengthSeconds) * 100}%"
						style:width={timelineMarkerWidth(
							chapter.time,
							content.timestamps[index + 1]?.time || video.lengthSeconds
						)}
					></div>
				{/each}
				{#if !$sponsorBlockTimelineStore}
					{#each segments as segment (segment)}
						{@const colors =
							segmentCategoryColors[segment.category] ?? segmentCategoryColors.sponsor}
						<div
							class="chapter-marker segment-marker"
							style:left="{(segment.startTime / video.lengthSeconds) * 100}%"
							style:width={timelineMarkerWidth(segment.startTime, segment.endTime)}
							style:--sg-color={colors.color}
							style:--sg-color-alt={colors.alt}
						></div>
					{/each}
				{/if}
			</div>
		{/if}

		<nav
			class="row tv-buttons no-wrap"
			bind:this={rowElement}
			aria-label={$_('player.controls.playbackControls')}
		>
			<button
				data-tv-button
				class="circle primary tv-play"
				aria-label={playing ? $_('player.controls.pause') : $_('player.controls.play')}
				onclick={onPlayPause}
			>
				<i>{playing ? 'pause' : 'play_arrow'}</i>
			</button>
			{#if hasNext}
				<button
					data-tv-button
					class="circle transparent tv-control-button"
					aria-label={$_('playlist.next')}
					onclick={onNext}
				>
					<i>skip_next</i>
				</button>
			{/if}
			{#if hasCaptions}
				<button
					data-tv-button
					class="circle transparent tv-control-button"
					aria-label={$_('player.controls.subtitles')}
					aria-pressed={captionsOn}
					aria-busy={$loadingCaptionTrack !== null}
					onclick={toggleCaptions}
				>
					{#if $loadingCaptionTrack}
						<progress class="circle small" aria-label={$_('player.controls.loadingCaptions')}
						></progress>
					{:else}
						<i>{captionsOn ? 'closed_caption' : 'closed_caption_off'}</i>
					{/if}
				</button>
			{/if}
			<button
				data-tv-button
				class="circle transparent tv-control-button"
				aria-label={$_('layout.settings')}
				onclick={(event) => onSettings(event.currentTarget as HTMLElement)}
			>
				<i>settings</i>
			</button>
			<button
				data-tv-button
				class="circle transparent tv-control-button"
				aria-label={$_('player.controls.videoInfo')}
				onclick={(event) => onInfo(event.currentTarget as HTMLElement)}
			>
				<i>info</i>
			</button>
			<div class="max"></div>
			{#if !video.liveNow}
				<p class="no-margin tv-elapsed">
					{videoLength(currentTime)} / {videoLength(video.lengthSeconds)}
				</p>
			{/if}
		</nav>
	</div>
</div>

<style>
	.tv-controls {
		/* 1u = 1px on a 1920-wide screen; keeps sizes independent of WebView density. */
		--u: calc(100vw / 1920);
		position: fixed;
		inset: 0;
		z-index: 100;
		pointer-events: none;
		visibility: hidden;
		opacity: 0;
		/* D-pad only. Never capture the pointer: toggling pointer-events under a stationary
		   TV WebView cursor fired mouseleave/enter on the player in a loop (flicker). */
		transition:
			opacity 0.2s,
			visibility 0.2s;
	}

	.tv-controls.visible {
		visibility: visible;
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.tv-controls {
			transition: none;
		}
	}

	.scrim {
		position: absolute;
		left: 0;
		right: 0;
		pointer-events: none;
	}

	.top-scrim {
		top: 0;
		height: calc(220 * var(--u));
		background: linear-gradient(rgba(0, 0, 0, 0.7), transparent);
	}

	.bottom-scrim {
		bottom: 0;
		height: calc(400 * var(--u));
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
	}

	.top-right {
		position: absolute;
		top: calc(28 * var(--u));
		right: calc(48 * var(--u));
		text-align: right;
		color: white;
	}

	.tv-clock {
		font-size: calc(40 * var(--u));
		font-weight: 700;
	}

	.tv-clock-sub {
		font-size: calc(26 * var(--u));
		opacity: 0.85;
	}

	.tv-chip {
		display: inline-block;
		padding: calc(6 * var(--u)) calc(18 * var(--u));
		border-radius: calc(8 * var(--u));
		background-color: var(--error);
		color: var(--on-error);
		font-size: calc(26 * var(--u));
		font-weight: 700;
	}

	.tv-title {
		position: absolute;
		left: calc(48 * var(--u));
		right: calc(48 * var(--u));
		bottom: calc(240 * var(--u));
		color: white;
	}

	.tv-title h4 {
		font-size: calc(40 * var(--u));
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.tv-subtitle {
		font-size: calc(28 * var(--u));
		opacity: 0.85;
	}

	.tv-progress {
		position: absolute;
		left: calc(48 * var(--u));
		right: calc(48 * var(--u));
		bottom: calc(200 * var(--u));
		height: calc(10 * var(--u));
	}

	.track-line {
		position: absolute;
		inset: 0;
		background-color: rgba(255, 255, 255, 0.3);
		border-radius: var(--player-border-radius);
	}

	.range {
		position: absolute;
		inset: 0 auto 0 0;
		background-color: var(--primary);
		border-radius: var(--player-border-radius);
		z-index: 1;
	}

	/* Timeline focus (paused): thicker track, knob and the same ring as the buttons. */
	.tv-progress:focus {
		outline: 3px solid var(--primary);
		outline-offset: calc(14 * var(--u));
		border-radius: calc(6 * var(--u));
	}

	.tv-progress:focus .track-line,
	.tv-progress:focus .range {
		transform: scaleY(1.8);
	}

	.thumb {
		display: none;
		position: absolute;
		top: 50%;
		width: calc(28 * var(--u));
		height: calc(28 * var(--u));
		margin: calc(-14 * var(--u)) 0 0 calc(-14 * var(--u));
		border-radius: 50%;
		background-color: var(--primary);
		z-index: 3;
	}

	.tv-progress:focus .thumb {
		display: block;
	}

	.chapter-marker {
		position: absolute;
		top: 0;
		bottom: 0;
		height: auto;
		background-color: rgba(255, 255, 255, 0.5);
		border-radius: var(--player-border-radius);
		z-index: 2;
		pointer-events: none;
		opacity: 0.5;
	}

	.segment-marker {
		opacity: 1;
		background: repeating-linear-gradient(
			-45deg,
			var(--sg-color) 0 10px,
			var(--sg-color-alt) 10px 15px
		);
	}

	.seek-preview {
		position: absolute;
		/* Above the title block so the preview never covers it. */
		bottom: calc(340 * var(--u));
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		color: white;
		pointer-events: none;
	}

	.seek-preview canvas {
		display: block;
		width: 180px;
		height: auto;
		border-radius: var(--border-radius);
		margin-bottom: calc(8 * var(--u));
	}

	.seek-preview-chapter {
		font-size: calc(24 * var(--u));
		opacity: 0.85;
	}

	.seek-preview-time {
		font-size: calc(26 * var(--u));
		font-weight: 700;
	}

	.tv-buttons {
		position: absolute;
		left: calc(36 * var(--u));
		right: calc(48 * var(--u));
		bottom: calc(40 * var(--u));
		align-items: center;
		gap: calc(24 * var(--u));
	}

	.tv-buttons button {
		flex-shrink: 0;
	}

	.tv-play {
		width: calc(96 * var(--u));
		height: calc(96 * var(--u));
	}

	.tv-play i {
		font-size: calc(52 * var(--u));
	}

	.tv-control-button {
		width: calc(68 * var(--u));
		height: calc(68 * var(--u));
		color: white;
	}

	.tv-control-button i {
		font-size: calc(38 * var(--u));
		filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.8));
	}

	.tv-buttons :focus {
		outline: 3px solid var(--primary);
		outline-offset: 2px;
	}

	.tv-elapsed {
		color: white;
		font-size: calc(28 * var(--u));
		font-variant-numeric: tabular-nums;
	}
</style>
