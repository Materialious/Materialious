<script lang="ts" module>
	let trackVisible: boolean = $state(false);
	let captionsCues: VTTCue[] = $state([]);

	const captionTracks: Record<string, string> = {};

	// Configurable settings for captions
	let captionFontSize: string = $state('16px');
	let captionColor: string = $state('white');
	let captionBackgroundColor: string = $state('rgba(0, 0, 0, 0.7)');
	let captionOpacity: number = $state(1);

	let captionBorderThickness: string = $state('0.1px');
	let captionBorderColor: string = $state('black');

	export function setTextTrackVisibility(visible: boolean = true) {
		trackVisible = visible;
	}

	// Function to update caption style settings
	export function updateCaptionStyles({
		fontSize,
		color,
		backgroundColor,
		opacity,
		borderThickness,
		borderColor
	}: {
		fontSize?: string;
		color?: string;
		backgroundColor?: string;
		opacity?: number;
		borderThickness?: string;
		borderColor?: string;
	}) {
		if (fontSize) captionFontSize = fontSize;
		if (color) captionColor = color;
		if (backgroundColor) captionBackgroundColor = backgroundColor;
		if (opacity !== undefined) captionOpacity = opacity;
		if (borderThickness) captionBorderThickness = borderThickness;
		if (borderColor) captionBorderColor = borderColor;
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

		captionsCues = (await parseText(await resp.text(), { strict: false })).cues;
	}
</script>

<script lang="ts">
	import { draggable, bounds, BoundsFrom, touchAction } from '@neodrag/svelte';
	import type { VideoPlay } from '$lib/api/model';
	import { findElementForTime, getPublicEnv } from '$lib/misc';
	import { invidiousInstanceStore } from '$lib/store';
	import { onMount } from 'svelte';
	import { addToast } from '../Toast.svelte';
	import { parseText, VTTCue } from 'media-captions';

	let {
		video,
		playerContainer,
		currentTime = $bindable(),
		showControls = $bindable()
	}: {
		video: VideoPlay;
		currentTime: number;
		showControls: boolean;
		playerContainer: HTMLElement;
	} = $props();

	onMount(async () => {
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

	function removeTags(input: string): string {
		return input.replace(/<[^>]+>/g, '').replace(/&[a-zA-Z0-9#]+;/g, '');
	}
</script>

{#if trackVisible && captionsCues.length > 0}
	{@const currentCaption = findElementForTime(
		captionsCues,
		currentTime,
		(cue: VTTCue) => cue.startTime,
		(cue: VTTCue) => cue.endTime
	)}
	<div
		{@attach draggable(() => [
			bounds(BoundsFrom.element(playerContainer)),
			touchAction('manipulation')
		])}
		style="z-index: 5;cursor: grab;"
	>
		{#if currentCaption?.text}
			<p
				style="
                    font-size: {captionFontSize};
                    color: {captionColor};
                    background-color: {captionBackgroundColor};
                    opacity: {captionOpacity};
                    padding: 5px;
                    width: fit-content;
                    border-radius: 0.25rem;
                    user-select: none;
                    -webkit-text-fill-color: {captionColor};
                    -webkit-text-stroke: {captionBorderThickness} {captionBorderColor};
                "
			>
				{removeTags(currentCaption.text)}
			</p>
		{/if}
	</div>
{/if}
