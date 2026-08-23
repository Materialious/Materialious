<script lang="ts">
	import { Capacitor } from '@capacitor/core';
	import { addToast } from '$lib/components/Toast.svelte';
	import {
		getDownloadFormats,
		isDownloadSupported,
		startDownload,
		type AvailableFormats,
		type DownloadSelection
	} from '$lib/api';
	import { _ } from '$lib/i18n';
	import { isOwnBackend } from '$lib/shared';
	import type { VideoPlay } from '$lib/api/model';
	import { Progress } from 'melt/builders';
	import { SvelteSet } from 'svelte/reactivity';
	import ui from 'beercss';
	import ISO6391 from 'iso-639-1';

	let { video }: { video: VideoPlay } = $props();

	const isElectron = Capacitor.getPlatform() === 'electron';

	let formats: AvailableFormats | null = $state(null);
	let loading = $state(false);
	let loadError = $state(false);
	let downloading = $state(false);
	let progress = $state(-1);

	let downloadType = $state<'merged' | 'audio'>('merged');
	let selectedQuality = $state<string | undefined>(undefined);
	let selectedContainer = $state<'mp4' | 'webm'>('mp4');
	let selectedAudioKey = $state<string | undefined>(undefined);

	const downloadProgress = new Progress({
		value: () => (progress >= 0 ? progress : undefined),
		max: 100
	});

	type FormatRow = AvailableFormats['formats'][number];

	const WEBM_VIDEO_CODECS = ['vp8', 'vp9', 'vp09', 'av01'];
	const WEBM_AUDIO_CODECS = ['opus', 'vorbis'];

	// MP4 only reliably holds H.264/AAC, WebM holds VP8/VP9/AV1 with
	// Opus/Vorbis; merging anything else produces broken files.
	function formatFamily(format: FormatRow): 'mp4' | 'webm' | null {
		const codec = format.codec?.toLowerCase() ?? '';

		if (codec) {
			if (codec.startsWith('avc') || codec.startsWith('mp4a')) return 'mp4';
			if (
				WEBM_VIDEO_CODECS.some((prefix) => codec.startsWith(prefix)) ||
				WEBM_AUDIO_CODECS.some((prefix) => codec.startsWith(prefix))
			) {
				return 'webm';
			}
			return null;
		}

		if (format.container === 'mp4') return 'mp4';
		if (format.container === 'webm') return 'webm';
		return null;
	}

	const containerOptions = $derived.by(() => {
		const all: ('mp4' | 'webm')[] = ['mp4', 'webm'];
		if (!formats) return all;

		const options = all.filter((container) =>
			formats!.formats.some(
				(format) => format.hasVideo && format.qualityLabel && formatFamily(format) === container
			)
		);

		return options.length > 0 ? options : all;
	});

	const qualityOptions: string[] = $derived.by(() => {
		if (!formats) return [];

		return Array.from(
			new Set(
				formats.formats
					.filter((format) => format.hasVideo && format.qualityLabel)
					.filter((format) => formatFamily(format) === selectedContainer)
					.map((format) => format.qualityLabel as string)
			)
		).sort((a, b) => {
			const aHeight = parseInt(a, 10);
			const bHeight = parseInt(b, 10);
			if (Number.isFinite(aHeight) && Number.isFinite(bHeight)) {
				return bHeight - aHeight;
			}
			return b.localeCompare(a);
		});
	});

	const audioOptions = $derived.by(() => {
		if (!formats) return [];

		const candidates = formats.formats.filter((format) => format.hasAudio && !format.hasVideo);
		const compatible = candidates.filter((format) => formatFamily(format) === selectedContainer);

		const seen = new SvelteSet<string>();

		return (compatible.length > 0 ? compatible : candidates)
			.filter((format) => {
				const key = `${format.language ?? 'x'}-${format.container}-${Math.round((format.bitrate ?? 0) / 1000)}`;
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.sort((a, b) => {
				const langCompare = (a.language ?? '').localeCompare(b.language ?? '');
				if (langCompare !== 0) return langCompare;
				return (b.bitrate ?? 0) - (a.bitrate ?? 0);
			});
	});

	$effect(() => {
		if (!formats) return;

		if (!containerOptions.includes(selectedContainer)) {
			selectedContainer = containerOptions[0];
		}
		if (selectedQuality !== undefined && !qualityOptions.includes(selectedQuality)) {
			selectedQuality = undefined;
		}
		if (
			selectedAudioKey !== undefined &&
			!audioOptions.some((format) => audioFormatKey(format) === selectedAudioKey)
		) {
			selectedAudioKey = undefined;
		}
	});

	function audioFormatKey(format: AvailableFormats['formats'][number]): string {
		return `${format.itag}-${format.language ?? ''}-${format.container}-${Math.round((format.bitrate ?? 0) / 1000)}`;
	}

	function audioLabel(format: AvailableFormats['formats'][number]): string {
		const parts: string[] = [];

		if (format.language) {
			parts.push(ISO6391.getName(format.language) || format.language);
		}
		if (format.bitrate) parts.push(`${Math.round(format.bitrate / 1000)} kbps`);
		if (format.container && format.container !== 'unknown') {
			parts.push(format.container.toUpperCase());
		}

		return parts.join(' · ');
	}

	async function loadFormats() {
		if (formats || loading || downloading) return;

		loading = true;
		loadError = false;

		try {
			formats = await getDownloadFormats(video);
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	function buildSelection(): DownloadSelection {
		const audioFormat = selectedAudioKey
			? formats?.formats.find((format) => audioFormatKey(format) === selectedAudioKey)
			: undefined;

		if (downloadType === 'audio') {
			return {
				type: 'audio',
				itag: audioFormat?.itag,
				language: audioFormat?.language ?? undefined,
				format: selectedContainer
			};
		}

		return {
			type: 'merged',
			quality: selectedQuality,
			itag: audioFormat?.itag,
			language: audioFormat?.language ?? undefined,
			format: selectedContainer,
			codec: selectedContainer === 'webm' ? 'vp9' : 'avc1'
		};
	}

	async function onDownloadButtonClick() {
		await loadFormats();

		downloadType = 'merged';
		selectedQuality = undefined;
		selectedContainer = 'mp4';
		selectedAudioKey = undefined;
	}

	async function startDialogDownload() {
		if (downloading || !formats) return;

		ui('#download-dialog');

		await download(buildSelection());
	}

	async function download(selection: DownloadSelection) {
		if (downloading) return;

		downloading = true;
		progress = -1;

		try {
			const result = await startDownload(video, selection, (value) => {
				progress = value;
			});

			if (isElectron || isOwnBackend()) {
				if (result.error) {
					addToast({ data: { text: result.error, icon: 'error' } });
				} else if (result.canceled) {
					addToast({ data: { text: $_('player.downloadCanceled'), icon: 'close' } });
				} else {
					addToast({ data: { text: $_('player.downloadComplete'), icon: 'download_done' } });
				}
			}
		} catch (err) {
			addToast({
				data: {
					text: err instanceof Error ? err.message : $_('player.downloadFailed'),
					icon: 'error'
				}
			});
		} finally {
			downloading = false;
		}
	}
</script>

{#if isDownloadSupported()}
	<button
		class="surface-container-highest"
		onclick={onDownloadButtonClick}
		data-ui="#download-dialog"
		disabled={downloading}
	>
		{#if downloading}
			<div class="download-progress" class:indeterminate={progress < 0} {...downloadProgress.root}>
				<div {...downloadProgress.progress}></div>
			</div>
			{#if progress >= 0}
				<span class="small-text">{Math.round(progress)}%</span>
			{/if}
		{:else}
			<i>download</i>
			<div class="tooltip">
				{$_('player.download')}
			</div>
		{/if}
	</button>

	<dialog id="download-dialog" class="modal">
		<header>
			<nav class="no-wrap">
				<h6 class="max no-margin">{$_('player.download')}</h6>
				<button class="circle transparent" data-ui="#download-dialog"><i>close</i></button>
			</nav>
		</header>

		{#if loading}
			<nav class="row">
				<progress class="circle indeterminate small"></progress>
				<div class="small-text">{$_('player.downloadLoading')}</div>
			</nav>
		{:else if loadError}
			<div class="row">
				<div class="max small-text">{$_('player.downloadFailed')}</div>
				<button class="small border" onclick={loadFormats}><i>refresh</i></button>
			</div>
		{:else if formats}
			<main>
				<nav class="chips">
					<button
						class:primary={downloadType === 'merged'}
						class:surface-container-highest={downloadType !== 'merged'}
						onclick={() => (downloadType = 'merged')}
					>
						<i>video_call</i>
						{$_('player.downloadVideoAudio')}
					</button>
					<button
						class:primary={downloadType === 'audio'}
						class:surface-container-highest={downloadType !== 'audio'}
						onclick={() => (downloadType = 'audio')}
					>
						<i>music_note</i>
						{$_('player.downloadAudio')}
					</button>
				</nav>

				{#if downloadType === 'merged'}
					{#if qualityOptions.length > 0}
						<h6>{$_('player.controls.quality')}</h6>
						<nav class="chips wrap">
							<button
								class:primary={selectedQuality === undefined}
								class:surface-container-highest={selectedQuality !== undefined}
								onclick={() => (selectedQuality = undefined)}
							>
								{$_('player.downloadBest')}
							</button>
							{#each qualityOptions as quality (quality)}
								<button
									class:primary={selectedQuality === quality}
									class:surface-container-highest={selectedQuality !== quality}
									onclick={() => (selectedQuality = quality)}
								>
									{quality}
								</button>
							{/each}
						</nav>
					{/if}
				{/if}

				{#if audioOptions.length > 0}
					<h6>{$_('player.controls.language')}</h6>
					<nav class="chips wrap">
						<button
							class:primary={selectedAudioKey === undefined}
							class:surface-container-highest={selectedAudioKey !== undefined}
							onclick={() => (selectedAudioKey = undefined)}
						>
							{$_('player.downloadBest')}
						</button>
						{#each audioOptions as format (audioFormatKey(format))}
							<button
								class:primary={selectedAudioKey === audioFormatKey(format)}
								class:surface-container-highest={selectedAudioKey !== audioFormatKey(format)}
								onclick={() => (selectedAudioKey = audioFormatKey(format))}
							>
								{audioLabel(format)}
							</button>
						{/each}
					</nav>
				{/if}

				<h6>{$_('player.downloadFormat')}</h6>
				<nav class="chips wrap">
					{#each containerOptions as container (container)}
						<button
							class:primary={selectedContainer === container}
							class:surface-container-highest={selectedContainer !== container}
							onclick={() => (selectedContainer = container)}
						>
							{container.toUpperCase()}
						</button>
					{/each}
				</nav>
			</main>

			<footer>
				<button class="primary" onclick={startDialogDownload} disabled={downloading}>
					<i>download</i>
					{$_('player.download')}
				</button>
			</footer>
		{/if}
	</dialog>
{/if}

<style>
	.download-progress {
		position: relative;
		inline-size: 1.5rem;
		block-size: 1.5rem;
		flex: none;
		color: inherit;
	}

	.download-progress [data-melt-progress-progress] {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: conic-gradient(currentColor calc(100% - var(--progress)), var(--active) 0);
		mask-image: radial-gradient(circle at center, transparent 57%, currentColor 60%);
	}

	.download-progress.indeterminate [data-melt-progress-progress] {
		background: conic-gradient(currentColor 25%, transparent 0);
		animation: to-rotate 1s infinite linear;
	}

	#download-dialog {
		display: flex;
		flex-direction: column;
		max-inline-size: 28rem;
		max-block-size: min(80dvh, 80%);
		overflow-y: auto;
	}

	#download-dialog main {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-block-size: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	#download-dialog main h6 {
		margin: 0.75rem 0 0.25rem;
	}

	#download-dialog footer {
		margin-block-start: 1.5rem;
		text-align: right;
	}
</style>
