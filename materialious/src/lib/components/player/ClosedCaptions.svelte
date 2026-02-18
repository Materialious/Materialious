<script lang="ts" module>
	let trackVisible: boolean = $state(false);
	let captionsCues: VTTCue[] = $state([]);

	let captionTracks: Record<string, string> = {};

	export function setTextTrackVisibility(visible: boolean) {
		trackVisible = visible;
	}

	// Fetch caption data for a selected language
	export async function selectTextTrack(language: string) {
		const resp = await fetch(captionTracks[language], { method: 'GET' });
		if (!resp.ok) {
			addToast({
				data: {
					text: 'Unable to fetch captions'
				}
			});
		}

		captionsCues = (await parseText(await resp.text(), { strict: true, type: 'vtt' })).cues;
	}
</script>

<script lang="ts">
	import type { VideoPlay } from '$lib/api/model';
	import { onDestroy, onMount } from 'svelte';
	import { addToast } from '../Toast.svelte';
	import { parseText, renderVTTCueString, type VTTCue } from 'media-captions';
	import { getCaptionUrl } from '$lib/player/captions';

	let {
		video,
		currentTime = $bindable(),
		showControls = $bindable()
	}: {
		video: VideoPlay;
		currentTime: number;
		showControls: boolean;
	} = $props();

	let captionElement: HTMLElement | undefined = $state();
	let captionContainerHeight: number = $state(0);

	function updateCaptionHeight() {
		if (captionElement) {
			captionContainerHeight = captionElement.offsetHeight;
		}
	}

	$effect(() => {
		updateCaptionHeight();
	});

	onMount(async () => {
		window.addEventListener('resize', updateCaptionHeight);

		if (video.captions) {
			for (const caption of video.captions) {
				const captionUrl = getCaptionUrl(caption, video.fallbackPatch);

				if (!captionUrl) continue;

				captionTracks[caption.language_code] = captionUrl;
			}
		}
	});

	onDestroy(() => {
		window.removeEventListener('resize', updateCaptionHeight);

		captionTracks = {};
		captionsCues = [];
		trackVisible = false;
	});
</script>

{#if trackVisible && captionsCues.length > 0}
	<div
		class="caption-container"
		bind:this={captionElement}
		style:top={`calc(${showControls ? 'var(--video-player-height) * var(--top-percentage-controls-shown)' : 'var(--video-player-height) * var(--top-percentage-controls-hidden)'} - ${captionContainerHeight}px)`}
	>
		{#each captionsCues as cue (cue)}
			<p class:hide={currentTime <= cue.startTime || currentTime >= cue.endTime}>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html renderVTTCueString(cue, currentTime)}
			</p>
		{/each}
	</div>
{/if}

<style>
	:root {
		--top-percentage-controls-shown: 0.85;
		--top-percentage-controls-hidden: 0.98;
	}

	.caption-container {
		position: absolute;
		z-index: 5;
		left: 50%;
		transform: translateX(-50%);
		width: fit-content;
	}

	p {
		padding: 5px;
		border-radius: 0.25rem;
		user-select: none;
		font-size: 1.5rem;
		color: #fff !important;
		background-color: rgb(0, 0, 0, 0.7);
	}

	@media screen and (max-width: 1000px) {
		:root {
			--top-percentage-controls-shown: 0;
		}

		.caption-container {
			width: 100%;
		}

		p {
			font-size: 1rem;
		}
	}
</style>
