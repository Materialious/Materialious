<script lang="ts">
	import type { ParsedDescription, Timestamp } from '$lib/description';
	import { invidiousInstanceStore, isAndroidTvStore, sponsorBlockTimelineStore } from '$lib/store';
	import type { Segment } from 'sponsorblock-api';
	import { Slider } from 'melt/builders';
	import { _ } from '$lib/i18n';
	import { ImageCache } from '$lib/images';
	import type { VideoPlay } from '$lib/api/model';
	import {
		generateThumbnailWebVTT,
		drawTimelineThumbnail,
		storyboardThumbnails,
		type TimelineThumbnail
	} from '$lib/player/thumbnails';
	import { onDestroy, onMount } from 'svelte';
	import { videoLength } from '$lib/numbers';
	import { truncate } from '$lib/misc';

	let {
		playerElement,
		currentTime,
		showPlayerUI,
		video,
		content,
		segments,
		userManualSeeking = $bindable(false),
		playerMaxKnownTime = $bindable()
	}: {
		currentTime: number;
		showPlayerUI: () => void;
		userManualSeeking: boolean;
		playerElement: HTMLMediaElement | undefined;
		video: VideoPlay;
		content: ParsedDescription;
		segments: Segment[];
		playerMaxKnownTime: number;
	} = $props();

	let playerSliderInteracted = $state(false);
	let playerShowTimelineThumbnail = $state(true);
	let playerCloestTimestamp: Timestamp | undefined = $state();
	let playerCloestSponsor: Segment | undefined = $state();
	let playerSliderElement: HTMLElement | undefined = $state();
	let playerSliderDebounce: ReturnType<typeof setTimeout>;
	let playerTimelineTooltip: HTMLDivElement | undefined = $state();
	let playerTimelineThumbnails: TimelineThumbnail[] = $state([]);
	let playerTimelineThumbnailsCache = new ImageCache();
	let playerTimelineThumbnailCanvas: {
		timeline?: HTMLCanvasElement;
		thumb?: HTMLCanvasElement;
	} = $state({});
	let playerTimelineTimeHover = $state(0);
	let playerBufferBar: HTMLElement | undefined = $state();
	let playerBufferedTo: number = $state(0);

	const sponsorSegments = {
		sponsor: $_('layout.sponsors.sponsor'),
		selfpromo: $_('layout.sponsors.unpaidSelfPromotion'),
		interaction: $_('layout.sponsors.interactionReminder'),
		intro: $_('layout.sponsors.intermissionIntroAnimation'),
		outro: $_('layout.sponsors.credits'),
		preview: $_('layout.sponsors.preViewRecapHook'),
		filler: $_('layout.sponsors.tangentJokes'),
		music_offtopic: $_('layout.sponsors.musicOffTopic')
	};

	const playerTimelineSlider = new Slider({
		min: 0,
		step: 0.1,
		value: () => currentTime,
		onValueChange: async (timeToSet) => {
			playerSliderInteracted = true;
			userManualSeeking = true;
			currentTime = timeToSet;

			showPlayerUI();
			setPlayerTimelineChapters(currentTime);

			if (playerTimelineThumbnailCanvas.thumb) {
				await setPlayerTimelineThumbnails(currentTime, playerTimelineThumbnailCanvas.thumb);
			}

			if (playerSliderDebounce) clearTimeout(playerSliderDebounce);

			playerSliderDebounce = setTimeout(() => {
				if (playerElement) {
					playerElement.currentTime = currentTime;
					userManualSeeking = false;
					playerSliderInteracted = false;
					playerShowTimelineThumbnail = false;
				}
			}, 300);
		},
		max: () => playerMaxKnownTime
	});

	onMount(async () => {
		playerElement?.addEventListener('timeupdate', () => {
			const buffered = playerElement.buffered;

			if (buffered.length > 0 && playerBufferBar) {
				playerBufferedTo = buffered.end(0);

				const bufferedPercent = (playerBufferedTo / playerMaxKnownTime) * 100;
				const progressPercent = (currentTime / playerMaxKnownTime) * 100;

				const bufferAhead = Math.max(0, bufferedPercent - progressPercent);

				const effectiveWidth = Math.min(bufferAhead, 100 - progressPercent);

				playerBufferBar.style.left = progressPercent + '%';
				playerBufferBar.style.width = effectiveWidth + '%';
			}
		});

		if (video.storyboards && video.storyboards.length > 2) {
			let thumbnailVTT: string | undefined;

			const selectedStoryboard = video.storyboards[2];

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
					playerMaxKnownTime
				);
			} else if (!video.fallbackPatch) {
				const thumbnailVTTResp = await fetch(`${$invidiousInstanceStore}${selectedStoryboard.url}`);
				if (thumbnailVTTResp.ok) thumbnailVTT = await thumbnailVTTResp.text();
			}

			if (thumbnailVTT) {
				try {
					storyboardThumbnails(thumbnailVTT).then((thumbnails) => {
						playerTimelineThumbnails = thumbnails;
					});
				} catch {
					// Continue regardless of error.
				}
			}
		}
	});

	onDestroy(() => {
		playerTimelineThumbnailsCache.clear();
	});

	const markerGapSize = 0.1;
	const minVisiblePercent = 0.05;
	function timelineMarkerWidth(startTime: number, endTime: number): string {
		const ratio = (endTime - startTime) / playerMaxKnownTime;
		if (ratio <= 0) return `0%`;

		let percent = ratio * 100;
		if (percent - markerGapSize >= minVisiblePercent) {
			percent = percent - markerGapSize;
		} else {
			percent = minVisiblePercent;
		}

		return `${percent}%`;
	}

	function setPlayerTimelineChapters(currentTime: number) {
		if (content.timestamps.length > 0) {
			playerCloestTimestamp = content.timestamps.find((chapter, chapterIndex) => {
				let endTime: number;
				if (chapterIndex === content.timestamps.length - 1) {
					endTime = video.lengthSeconds;
				} else {
					endTime = content.timestamps[chapterIndex + 1].time;
				}
				return currentTime >= chapter.time && currentTime < endTime;
			});
		}

		if (segments.length > 0) {
			playerCloestSponsor = segments.find((segment) => {
				return currentTime >= segment.startTime && currentTime < segment.endTime;
			});
		}
	}

	async function setPlayerTimelineThumbnails(time: number, canvas: HTMLCanvasElement) {
		const canvasContext = canvas.getContext('2d');

		if (canvasContext) {
			await drawTimelineThumbnail(
				canvasContext,
				playerTimelineThumbnailsCache,
				playerTimelineThumbnails,
				time
			);
		}
	}

	let requestAnimationTooltip: number | undefined;
	let latestMouseX: number | undefined;

	function timelineMouseMove(event: MouseEvent) {
		latestMouseX = event.clientX;

		if (!requestAnimationTooltip) {
			requestAnimationTooltip = requestAnimationFrame(updateTooltip);
		}
	}

	async function updateTooltip() {
		if (!playerSliderElement || latestMouseX === undefined) {
			requestAnimationTooltip = undefined;
			return;
		}
		const rect = playerSliderElement.getBoundingClientRect();
		const percent = Math.min(Math.max((latestMouseX - rect.left) / rect.width, 0), 1);

		playerTimelineTimeHover = percent * (video.lengthSeconds ?? 0);
		setPlayerTimelineChapters(playerTimelineTimeHover);

		if (playerTimelineThumbnailCanvas.timeline) {
			await setPlayerTimelineThumbnails(
				playerTimelineTimeHover,
				playerTimelineThumbnailCanvas.timeline
			);
		}

		if (playerTimelineTooltip) {
			const tooltipWidth = playerTimelineTooltip.offsetWidth;
			const tooltipHeight = playerTimelineTooltip.offsetHeight;
			const sliderWidth = playerSliderElement.clientWidth;

			let left = percent * sliderWidth;
			left = Math.min(Math.max(left, tooltipWidth / 2), sliderWidth - tooltipWidth / 2);
			playerTimelineTooltip.style.transform = `translateX(${left - tooltipWidth / 2}px)`;

			playerTimelineTooltip.style.top = `${-tooltipHeight - 5}px`;
		}

		playerShowTimelineThumbnail = true;
		requestAnimationTooltip = undefined;
	}
</script>

<div
	class="player-slider full-width"
	class:disable-tv={$isAndroidTvStore}
	{...playerTimelineSlider.root}
	onmousemove={timelineMouseMove}
	bind:this={playerSliderElement}
>
	{#snippet timelineTooltip(key: 'thumb' | 'timeline', timeInSeconds: number)}
		{#if playerTimelineThumbnails.length > 0}
			<canvas
				bind:this={playerTimelineThumbnailCanvas[key]}
				width={playerTimelineThumbnails[0].width}
				height={playerTimelineThumbnails[0].height}
			></canvas>
		{/if}
		{#if playerCloestSponsor}
			<p class="no-margin" style="padding: 0 0.5rem;">
				{sponsorSegments[playerCloestSponsor.category]}
			</p>
		{:else if playerCloestTimestamp}
			<p class="no-margin" style="padding: 0 0.5rem;">
				{truncate(playerCloestTimestamp.title, 20)}
			</p>
		{/if}
		{videoLength(timeInSeconds)}
	{/snippet}
	<div class="track">
		{#if !userManualSeeking && playerShowTimelineThumbnail}
			<div bind:this={playerTimelineTooltip} class="timeline tooltip">
				{@render timelineTooltip('timeline', playerTimelineTimeHover)}
			</div>
		{/if}
		<div class="range"></div>
		<div {...playerTimelineSlider.thumb}>
			{#if playerSliderInteracted}
				<div class="tooltip thumb">
					{@render timelineTooltip('thumb', currentTime)}
				</div>
			{/if}
		</div>
	</div>
	<div bind:this={playerBufferBar} class="buffered-bar" class:hide={userManualSeeking}></div>
	{#each content.timestamps as chapter, index (chapter)}
		<div
			class="chapter-marker"
			style:left="{(chapter.time / playerMaxKnownTime) * 100}%"
			style:width={timelineMarkerWidth(
				chapter.time,
				content.timestamps[index + 1]?.time || playerMaxKnownTime // Next chapter time or end of video
			)}
		></div>
	{/each}
	{#if !$sponsorBlockTimelineStore}
		{#each segments as segment (segment)}
			<div
				class="chapter-marker segment-marker"
				style:left="{(segment.startTime / playerMaxKnownTime) * 100}%"
				style:width={timelineMarkerWidth(segment.startTime, segment.endTime)}
			></div>
		{/each}
	{/if}
</div>

<style>
	:root {
		--player-timeline-height: 1.1rem;
	}

	.timeline.tooltip canvas,
	.tooltip.thumb canvas {
		display: block;
		margin-bottom: 0.1rem;
		height: 100px;
		border-radius: 0.25rem;
	}

	.timeline.tooltip {
		position: absolute;
		left: 0;
		transform: translateX(0%);
		transition: none;
		pointer-events: none;
		will-change: transform;
		padding: 0;
		display: block;
	}

	.tooltip.thumb {
		left: var(--percentage);
		display: block;
		padding: 0;
	}

	.buffered-bar {
		position: absolute;
		height: var(--player-timeline-height);
		background: var(--secondary);
		top: 50%;
		left: 0;
		transform: translateY(-50%);
		z-index: 1;
		pointer-events: none;
		border-top-right-radius: 0.25rem;
		border-bottom-right-radius: 0.25rem;
		opacity: 0.5;
	}

	.chapter-marker {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		left: 0;
		height: var(--player-timeline-height);
		background-color: var(--secondary);
		border-radius: 0.25rem;
		z-index: 2;
		pointer-events: none;
		opacity: 0.5;
	}

	.segment-marker {
		background-color: var(--tertiary);
	}

	.disable-tv {
		pointer-events: none;
		cursor: not-allowed;
	}
</style>
