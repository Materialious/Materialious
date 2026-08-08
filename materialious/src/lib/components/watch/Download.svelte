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

	let { videoId }: { videoId: string } = $props();

	const isElectron = Capacitor.getPlatform() === 'electron';

	let formats: AvailableFormats | null = $state(null);
	let loading = $state(false);
	let loadError = $state(false);
	let downloading = $state(false);
	let progress = $state(0);

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
			formats = await getDownloadFormats(videoId);
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	async function download(selection: Parameters<typeof startDownload>[1]) {
		if (downloading) return;

		downloading = true;
		progress = 0;

		if (isElectron) {
			try {
				const result = await startDownload(videoId, selection, (value) => {
					progress = value;
				});

				if (result.error) {
					addToast({ data: { text: result.error, icon: 'error' } });
				} else if (result.canceled) {
					addToast({ data: { text: $_('player.downloadCanceled'), icon: 'close' } });
				} else {
					addToast({ data: { text: $_('player.downloadComplete'), icon: 'download_done' } });
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
		} else {
			await startDownload(videoId, selection);
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
			<progress class="circle small" value={progress} max="100"></progress>
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
