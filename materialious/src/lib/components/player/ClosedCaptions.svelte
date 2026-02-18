<script lang="ts" module>
	let trackVisible: boolean = $state(false);
	let captionsCues: VTTCue[] = $state([]);

	const captionTracks: Record<string, string> = {};

	let captionFontSize: string = $state('1em');
	let captionColor: string = $state('white');
	let captionBackgroundColor: string = $state('rgba(0, 0, 0, 0.7)');
	let captionOpacity: number = $state(1);

	export function setTextTrackVisibility(visible: boolean = true) {
		trackVisible = visible;
	}

	// Function to update caption style settings
	export function updateCaptionStyles({
		fontSize,
		color,
		backgroundColor,
		opacity
	}: {
		fontSize?: string;
		color?: string;
		backgroundColor?: string;
		opacity?: number;
	}) {
		if (fontSize) captionFontSize = fontSize;
		if (color) captionColor = color;
		if (backgroundColor) captionBackgroundColor = backgroundColor;
		if (opacity !== undefined) captionOpacity = opacity;
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
	import { decodeHtmlCharCodes, findElementForTime, getPublicEnv } from '$lib/misc';
	import { invidiousInstanceStore } from '$lib/store';
	import { onDestroy, onMount } from 'svelte';
	import { addToast } from '../Toast.svelte';
	import { parseText, type VTTCue } from 'media-captions';

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

	let currentCaption: VTTCue | null = $state(null);

	function updateCaptionHeight() {
		if (captionElement) {
			captionContainerHeight = captionElement.offsetHeight;
		}
	}

	$effect(() => {
		updateCaptionHeight();

		currentCaption = findElementForTime(
			captionsCues,
			currentTime,
			(cue: VTTCue) => cue.startTime,
			(cue: VTTCue) => cue.endTime
		);
	});

	onMount(async () => {
		window.addEventListener('resize', updateCaptionHeight);

		if (video.captions) {
			for (const caption of video.captions) {
				let captionUrl: string;
				if (!getPublicEnv('DEFAULT_COMPANION_INSTANCE') && $invidiousInstanceStore) {
					captionUrl = caption.url.startsWith('http')
						? caption.url
						: `${new URL($invidiousInstanceStore).origin}${caption.url}`;
				} else {
					captionUrl = `${getPublicEnv('DEFAULT_COMPANION_INSTANCE')}${caption.url}`;
				}

				captionTracks[caption.language_code] = captionUrl;
			}
		}
	});

	onDestroy(() => {
		window.removeEventListener('resize', updateCaptionHeight);
	});
</script>

{#if trackVisible && captionsCues.length > 0}
	{#if currentCaption && currentTime <= currentCaption.endTime && currentTime >= currentCaption.startTime}
		<div
			class="caption-container"
			bind:this={captionElement}
			style:top={`calc(${showControls ? 'var(--video-player-height) * 0.85' : 'var(--video-player-height) * 0.98'} - ${captionContainerHeight}px)`}
		>
			{#if currentCaption?.text}
				<p
					style="
					font-size: {captionFontSize};
					color: {captionColor};
					background-color: {captionBackgroundColor};
					opacity: {captionOpacity};
					padding: 5px;
					border-radius: 0.25rem;
					user-select: none;
				"
				>
					{decodeHtmlCharCodes(currentCaption.text)}
				</p>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.caption-container {
		position: absolute;
		z-index: 5;
		left: 50%;
		transform: translateX(-50%);
		width: fit-content;
	}

	@media screen and (max-width: 1000px) {
		.caption-container {
			width: 100%;
		}
	}
</style>
