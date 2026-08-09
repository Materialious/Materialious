<script lang="ts">
	import { Capacitor } from '@capacitor/core';
	import { addToast } from '$lib/components/Toast.svelte';
	import {
		getDownloadFormats,
		isDownloadSupported,
		startDownload,
		type AvailableFormats
	} from '$lib/api';
	import { _ } from '$lib/i18n';
	import { isOwnBackend } from '$lib/shared';
	import type { VideoPlay } from '$lib/api/model';
	import { Progress } from 'melt/builders';

	let { video }: { video: VideoPlay } = $props();

	const isElectron = Capacitor.getPlatform() === 'electron';

	let formats: AvailableFormats | null = $state(null);
	let loading = $state(false);
	let loadError = $state(false);
	let downloading = $state(false);
	let progress = $state(-1);

	const downloadProgress = new Progress({
		value: () => (progress >= 0 ? progress : undefined),
		max: 100
	});

	const qualityOptions: string[] = $derived.by(() => {
		if (!formats) return [];

		return Array.from(
			new Set(
				formats.formats
					.filter((format) => format.hasVideo && format.qualityLabel)
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

	async function download(selection: Parameters<typeof startDownload>[1]) {
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
		onclick={loadFormats}
		data-ui="#download-menu"
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

		<menu id="download-menu" class="mobile no-wrap" data-ui="#download-menu">
			{#if loading}
				<li>
					<div class="small-text">{$_('player.downloadLoading')}</div>
				</li>
			{:else if loadError}
				<li>
					<div class="small-text">{$_('player.downloadFailed')}</div>
				</li>
			{:else if formats}
				{#if qualityOptions.length > 0}
					<li
						class="row"
						role="presentation"
						data-ui="#download-menu"
						onclick={() => download({ type: 'merged', quality: undefined })}
					>
						<div class="min">{$_('player.downloadBest')}</div>
					</li>
					{#each qualityOptions as quality (quality)}
						<li
							class="row"
							role="presentation"
							data-ui="#download-menu"
							onclick={() => download({ type: 'merged', quality })}
						>
							<div class="min">{quality}</div>
						</li>
					{/each}
					<div class="divider"></div>
				{/if}
				<li
					class="row"
					role="presentation"
					data-ui="#download-menu"
					onclick={() => download({ type: 'audio' })}
				>
					<div class="min">{$_('player.downloadAudio')}</div>
				</li>
			{/if}
		</menu>
	</button>
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
</style>
