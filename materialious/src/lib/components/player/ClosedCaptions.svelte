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
	bind:this={captionElement}
	class:hide={!trackVisible}
></div>

<style>
	#captions {
		--overlay-padding: 1%;
		--cue-color: white;
		--cue-bg-color: rgba(0, 0, 0, 0.8);
		--cue-font-size: calc(var(--overlay-height) / 100 * 3);
		--cue-line-height: calc(var(--cue-font-size) * 1.2);
		--cue-padding-x: calc(var(--cue-font-size) * 0.6);
		--cue-padding-y: calc(var(--cue-font-size) * 0.4);

		bottom: 30px;
		left: 55%;
		transform: translateX(-50%); /* true horizontal centering */
	}

	#captions.controls-shown {
		bottom: 80px;
	}

	@media screen and (max-width: 1000px) {
		#captions {
			--cue-font-size: calc(var(--overlay-height) / 100 * 8);
			bottom: 0px;
			width: 100%;
		}

		#captions.controls-shown {
			display: none;
		}
	}
</style>
