<script lang="ts" module>
	import { activeCaptionTrack } from '#lib/store';
	import { writable } from 'svelte/store';

	export const loadingCaptionTrack = writable<string | null>(null);

	// The player controls outside this component address the currently mounted player.
	let controller: { select: (track: string) => Promise<void>; hide: () => void } | undefined;

	export function setTextTrackVisibility(visible: boolean) {
		if (!visible) controller?.hide();
		else if (controller) void controller.select('');
	}

	export async function selectTextTrack(track: string) {
		await controller?.select(track);
	}
</script>

<script lang="ts">
	import type { VideoPlay } from '#lib/api/model';
	import { onMount, untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { get } from 'svelte/store';
	import ISO6391 from 'iso-639-1';
	import { parseResponse, CaptionsRenderer } from 'media-captions';
	import { addToast } from '../Toast.svelte';
	import { getCaptionUrls, fetchCaption } from '#lib/player/captions';
	import { subtitleSettings, playerDefaultSubtitleLanguage, playerCCByDefault } from '#lib/store';
	import 'media-captions/styles/captions.css';
	import 'media-captions/styles/regions.css';

	let {
		video,
		playerElement,
		showControls
	}: {
		video: VideoPlay;
		playerElement?: HTMLMediaElement;
		showControls: boolean;
	} = $props();

	let captionElement: HTMLElement;
	let renderer: CaptionsRenderer | undefined;
	let loadedTrack: Awaited<ReturnType<typeof parseResponse>> | undefined;
	let bounds = $state({ left: 0, top: 0, width: 0, height: 0, controlsTop: 0 });
	let captionHeight = $derived(
		Math.max(
			0,
			bounds.height -
				(showControls
					? Math.max(bounds.height * 0.02, bounds.top + bounds.height - bounds.controlsTop + 8)
					: bounds.height * 0.02)
		)
	);
	let tracks = $derived(
		video.captions
			.map((track) => ({
				...track,
				urls: getCaptionUrls(track, video.fallbackPatch)
			}))
			.filter((track) => track.urls.length > 0)
	);
	let generation = 0;
	let lastTrack = '';
	const cachedTracks = new SvelteMap<string, Awaited<ReturnType<typeof parseResponse>>>();

	function defaultTrack() {
		const language = get(playerDefaultSubtitleLanguage);
		if (language === 'original' || !language) {
			return tracks.find((track) => /auto/i.test(track.label)) ?? tracks[0];
		}
		const code = ISO6391.getCode(language) || language.toLowerCase();
		return (
			tracks.find((track) => track.language_code.toLowerCase() === code.toLowerCase()) ??
			tracks.find((track) => track.language_code.toLowerCase().startsWith(`${code.toLowerCase()}-`))
		);
	}

	async function select(trackId: string) {
		const track =
			tracks.find((item) => item.url === trackId) ??
			tracks.find((item) => item.language_code === trackId) ??
			(!trackId ? (tracks.find((item) => item.url === lastTrack) ?? defaultTrack()) : undefined);
		if (!track || !renderer) return;
		const request = ++generation;
		try {
			let parsed = untrack(() => cachedTracks.get(track.url));
			if (!parsed) {
				loadingCaptionTrack.set(track.url);
				const response = await fetchCaption(track.urls);
				if (!response) throw new Error('Caption fetch failed');
				parsed = await parseResponse(response);
				if (request !== generation || !renderer) return;
				cachedTracks.set(track.url, parsed);
			} else {
				loadingCaptionTrack.set(null);
			}
			if (request !== generation || !renderer) return;
			renderer.changeTrack(parsed);
			loadedTrack = parsed;
			lastTrack = track.url;
			activeCaptionTrack.set(track.url);
		} catch {
			if (request === generation) addToast({ data: { text: 'Unable to fetch captions' } });
		} finally {
			if (request === generation) loadingCaptionTrack.set(null);
		}
	}

	function hide() {
		generation++;
		loadingCaptionTrack.set(null);
		activeCaptionTrack.set(null);
	}

	onMount(() => {
		renderer = new CaptionsRenderer(captionElement);
		const instance = { select, hide };
		controller = instance;
		if (get(playerCCByDefault)) void select('');
		return () => {
			generation++;
			renderer?.destroy();
			renderer = undefined;
			if (controller === instance) {
				loadingCaptionTrack.set(null);
				controller = undefined;
				activeCaptionTrack.set(null);
			}
		};
	});

	$effect(() => {
		// Reset on navigation even when the player component is reused.
		void video.videoId;
		generation++;
		lastTrack = '';
		cachedTracks.clear();
		loadingCaptionTrack.set(null);
		loadedTrack = undefined;
		renderer?.reset();
		activeCaptionTrack.set(null);
		if (renderer && get(playerCCByDefault)) void select('');
	});

	$effect(() => {
		const element = playerElement;
		if (!(element instanceof HTMLVideoElement)) return;
		const parent = captionElement.parentElement;
		if (!parent) return;
		const controls = parent.querySelector<HTMLElement>('#player-controls');
		const measure = () => {
			const box = element.getBoundingClientRect();
			const parentBox = parent.getBoundingClientRect();
			const ratio =
				element.videoWidth && element.videoHeight
					? element.videoWidth / element.videoHeight
					: box.width / box.height;
			const width = Math.min(box.width, box.height * ratio);
			const height = Math.min(box.height, box.width / ratio);
			if (Number.isFinite(width) && Number.isFinite(height))
				bounds = {
					left: box.left - parentBox.left + (box.width - width) / 2,
					top: box.top - parentBox.top + (box.height - height) / 2,
					width,
					height,
					controlsTop: controls
						? controls.getBoundingClientRect().top - parentBox.top
						: box.bottom - parentBox.top - Math.min(80, height * 0.2)
				};
		};
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		observer.observe(parent);
		if (controls) observer.observe(controls);
		element.addEventListener('loadedmetadata', measure);
		element.addEventListener('resize', measure);
		measure();
		return () => {
			observer.disconnect();
			element.removeEventListener('loadedmetadata', measure);
			element.removeEventListener('resize', measure);
		};
	});

	$effect(() => {
		// Rebuild cue positions after the renderer has processed its resize. Its
		// cached starting boxes otherwise retain positions from the old overlay.
		void captionHeight;
		void bounds.width;
		const timer = setTimeout(() => {
			if (renderer && loadedTrack) renderer.changeTrack(loadedTrack);
		}, 100);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const element = playerElement;
		const offset = $subtitleSettings.offset ?? 0;
		if (!element) return;
		let frame = 0;
		const update = () => {
			if (renderer) renderer.currentTime = element.currentTime - offset;
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
		element.addEventListener('seeked', update);
		element.addEventListener('seeking', update);
		if (!element.paused) start();
		else update();
		return () => {
			cancelAnimationFrame(frame);
			element.removeEventListener('play', start);
			element.removeEventListener('pause', stop);
			element.removeEventListener('ended', stop);
			element.removeEventListener('seeked', update);
			element.removeEventListener('seeking', update);
		};
	});
</script>

<div
	id="captions"
	class:hide={$activeCaptionTrack === null}
	bind:this={captionElement}
	style:left="{bounds.left}px"
	style:top="{bounds.top}px"
	style:width="{bounds.width}px"
	style:height="{captionHeight}px"
	style:--cue-color={$subtitleSettings.color}
	style:--cue-bg-color={$subtitleSettings.backgroundColor}
	style:--cue-font-size="{(bounds.height / 100) * $subtitleSettings.fontSize}px"
	style:--cue-text-shadow={$subtitleSettings.textShadow}
	style:--user-cue-alignment={$subtitleSettings.alignment ?? 'center'}
	style:font-family={!$subtitleSettings.fontFamily || $subtitleSettings.fontFamily === 'inherit'
		? 'var(--font)'
		: $subtitleSettings.fontFamily}
></div>

<style>
	#captions {
		--overlay-padding: 0px;
		margin: 0;
		clip-path: inset(0);
	}
	#captions :global([part='cue-display']) {
		text-align: var(--user-cue-alignment);
	}
</style>
