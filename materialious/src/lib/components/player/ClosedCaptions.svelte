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

<div bind:this={captionElement} class:hide={!trackVisible}></div>
