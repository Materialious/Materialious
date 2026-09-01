<script lang="ts" module>
	import { activeCaptionTrack } from '$lib/store';
	import { get } from 'svelte/store';
	import { addToast } from '../Toast.svelte';
	import { parseResponse, CaptionsRenderer } from 'media-captions';

	let renderer: CaptionsRenderer | undefined;

	let captionTracks: Record<string, string> = {};

	export function setTextTrackVisibility(visible: boolean) {
		if (!visible) {
			activeCaptionTrack.set(null);
			return;
		}
		// Re-apply the currently active track (or default language) so visibility
		// toggling stays in sync with the single source of truth.
		const active = get(activeCaptionTrack);
		if (active) {
			void selectTextTrack(active);
		}
	}

	// Fetch caption data for a selected language
	export async function selectTextTrack(language: string) {
		if (!language) {
			// Default to the first available track when no language specified.
			language = Object.keys(captionTracks)[0] ?? '';
		}
		if (!language || !captionTracks[language]) return;

		const resp = await fetch(captionTracks[language], { method: 'GET' });
		if (!resp.ok) {
			addToast({
				data: {
					text: 'Unable to fetch captions'
				}
			});
			return;
		}

		try {
			renderer?.changeTrack(await parseResponse(resp));
			activeCaptionTrack.set(language);
		} catch {
			addToast({
				data: {
					text: 'Unable to fetch captions'
				}
			});
		}
	}
</script>

<script lang="ts">
	import type { VideoPlay } from '$lib/api/model';
	import { onDestroy, onMount } from 'svelte';
	import { getCaptionUrl } from '$lib/player/captions';
	import { subtitleSettings, playerDefaultSubtitleLanguage, playerCCByDefault } from '$lib/store';
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
	let hasTracks = $state(false);

	let trackVisible = $derived(hasTracks && $activeCaptionTrack !== null);

	onMount(async () => {
		if (video.captions) {
			for (const caption of video.captions) {
				const captionUrl = getCaptionUrl(caption, video.fallbackPatch);

				if (!captionUrl) continue;

				captionTracks[caption.language_code] = captionUrl;
			}
			hasTracks = Object.keys(captionTracks).length > 0;
		}

		if (captionElement) {
			renderer = new CaptionsRenderer(captionElement);
		}

		// Apply default subtitle language on load when subtitles are enabled by default.
		if (hasTracks && get(playerCCByDefault)) {
			const defaultLang = get(playerDefaultSubtitleLanguage);
			const langCode = getLangCode(defaultLang, video);

			if (langCode && captionTracks[langCode]) {
				await selectTextTrack(langCode);
			}
		}
	});

	onDestroy(() => {
		captionTracks = {};
		activeCaptionTrack.set(null);
	});

	function getLangCode(defaultLang: string, video: VideoPlay): string | undefined {
		if (defaultLang === 'original') {
			const auto = video.captions.find((c) => /auto/i.test(c.label));
			return auto?.language_code ?? video.captions[0]?.language_code;
		}
		return video.captions.find((c) => c.language_code.startsWith(defaultLang))?.language_code;
	}

	let captionStyle = $derived({
		'--cue-color': $subtitleSettings.color,
		'--cue-bg-color': $subtitleSettings.backgroundColor,
		'--cue-font-size': `calc(var(--overlay-height) / 100 * ${$subtitleSettings.fontSize})`,
		'--cue-text-shadow': $subtitleSettings.textShadow,
		'--cue-font-family': $subtitleSettings.fontFamily ?? 'inherit',
		'--cue-text-align': $subtitleSettings.alignment ?? 'center'
	} as Record<string, string>);

	$effect(() => {
		if (!renderer) return;
		// Apply subtitle timing offset (positive = delay subtitles).
		const offset = $subtitleSettings.offset ?? 0;
		renderer.currentTime = (currentTime ?? 0) - offset;
	});
</script>

<div
	id="captions"
	class:controls-shown={showControls}
	class:hide={!trackVisible}
	bind:this={captionElement}
	style="left: 50%;bottom: {showControls
		? '80px'
		: '30px'};transform: translateX(-50%);{Object.entries(captionStyle)
		.map(([k, v]) => `${k}:${v};`)
		.join('')}"
></div>

<style>
	#captions {
		--overlay-padding: 1%;
		--cue-line-height: calc(var(--cue-font-size) * 1.2);
		--cue-padding-x: calc(var(--cue-font-size) * 0.6);
		--cue-padding-y: calc(var(--cue-font-size) * 0.4);
		text-align: var(--cue-text-align);

		position: absolute;
		z-index: 1;
		pointer-events: none;
	}

	@media screen and (max-width: 1000px) {
		#captions {
			/* Keep captions visible above controls on mobile instead of hiding them. */
			display: block !important;
		}
	}
</style>
