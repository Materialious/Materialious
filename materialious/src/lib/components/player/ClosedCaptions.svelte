<script lang="ts" module>
	let trackVisible: boolean = $state(false);
	let renderer: CaptionsRenderer | undefined;

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

		renderer?.changeTrack(await parseResponse(resp));
	}
</script>

<script lang="ts">
	import type { VideoPlay } from '$lib/api/model';
	import { onDestroy, onMount } from 'svelte';
	import { addToast } from '../Toast.svelte';
	import { parseResponse, CaptionsRenderer } from 'media-captions';
	import { getCaptionUrl } from '$lib/player/captions';
	import { subtitleSettings } from '$lib/store';
	import 'media-captions/styles/captions.css';

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

	onMount(async () => {
		if (video.captions) {
			for (const caption of video.captions) {
				const captionUrl = getCaptionUrl(caption, video.fallbackPatch);

				if (!captionUrl) continue;

				captionTracks[caption.language_code] = captionUrl;
			}
		}

		if (captionElement) {
			renderer = new CaptionsRenderer(captionElement);
		}
	});

	onDestroy(() => {
		captionTracks = {};
		trackVisible = false;
	});

	$effect(() => {
		if (!renderer) return;
		renderer.currentTime = currentTime;
	});
</script>

<div
	id="captions"
	class:controls-shown={showControls}
	class:hide={!trackVisible}
	bind:this={captionElement}
	style="left: 50%;bottom: {showControls
		? '80px'
		: '30px'};transform: translateX(-50%);--cue-color: {$subtitleSettings.color};--cue-bg-color: {$subtitleSettings.backgroundColor};--cue-font-size: calc(var(--overlay-height) / 100 * {$subtitleSettings.fontSize});--cue-text-shadow: {$subtitleSettings.textShadow};"
></div>

<style>
	#captions {
		--overlay-padding: 1%;
		--cue-line-height: calc(var(--cue-font-size) * 1.2);
		--cue-padding-x: calc(var(--cue-font-size) * 0.6);
		--cue-padding-y: calc(var(--cue-font-size) * 0.4);

		position: absolute;
		z-index: 1;
	}

	@media screen and (max-width: 1000px) {
		#captions {
			--cue-font-size: calc(var(--overlay-height) / 100 * 8);
		}

		#captions.controls-shown {
			display: none;
		}
	}
</style>
