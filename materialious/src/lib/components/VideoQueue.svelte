<script lang="ts">
	import ui from 'beercss';
	import { _ } from '#lib/i18n/index';
	import { videoQueueStore } from '#lib/store';
	import { onMount } from 'svelte';
	import VideoThumbnail from '#lib/components/thumbnail/VideoThumbnail.svelte';
	import type { VideoBase } from '#lib/api/model';
	import type { QueuedVideo } from '#lib/store';

	const dialogId = 'dialog-video-queue';
	onMount(() => {
		ui(`#${dialogId}`);
	});

	function moveVideo(videoId: string, direction: -1 | 1) {
		videoQueueStore.update((queue) => {
			const index = queue.findIndex((video) => video.videoId === videoId);
			const target = index + direction;
			if (index < 0 || target < 0 || target >= queue.length) return queue;
			const reordered = [...queue];
			[reordered[index], reordered[target]] = [reordered[target], reordered[index]];
			return reordered;
		});
	}

	function toThumbnailVideo(video: QueuedVideo): VideoBase {
		return {
			type: 'video',
			videoId: video.videoId,
			title: video.title,
			author: video.author,
			authorId: '',
			lengthSeconds: 0,
			viewCountText: video.viewCountText ?? '',
			videoThumbnails: [
				{
					url: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
					width: 480,
					height: 360
				}
			]
		};
	}
</script>

<dialog id={dialogId} class="right surface-container queue-dialog">
	<header class="row">
		<h4 class="max">{$_('queue.header')}</h4>
		<button class="circle transparent" data-ui={`#${dialogId}`} aria-label={$_('cancel')}>
			<i>close</i>
		</button>
	</header>
	{@render queueItems()}
</dialog>

{#snippet queueItems()}
	{#if $videoQueueStore.length === 0}
		<p class="queue-empty">{$_('queue.empty')}</p>
	{:else}
		<div class="queue-list">
			{#each $videoQueueStore as video, index (video.videoId)}
				<div class="queue-row">
					<div class="queue-controls">
						<button
							class="circle transparent"
							disabled={index === 0}
							aria-label={$_('queue.moveUp')}
							title={$_('queue.moveUp')}
							onclick={() => moveVideo(video.videoId, -1)}><i>keyboard_arrow_up</i></button
						>
						<button
							class="circle transparent"
							disabled={index === $videoQueueStore.length - 1}
							aria-label={$_('queue.moveDown')}
							title={$_('queue.moveDown')}
							onclick={() => moveVideo(video.videoId, 1)}><i>keyboard_arrow_down</i></button
						>
					</div>
					<article class="queue-thumbnail no-padding border">
						<VideoThumbnail
							video={toThumbnailVideo(video)}
							sideways={true}
							forceSideways={true}
							queueAction="remove"
						/>
					</article>
				</div>
			{/each}
		</div>
	{/if}
{/snippet}

<style>
	.queue-dialog {
		width: min(32rem, calc(100vw - 2rem));
		max-width: 100%;
		padding: 1rem;
	}

	.queue-dialog header {
		align-items: center;
		margin-bottom: 1rem;
	}

	.queue-dialog h4 {
		margin: 0 0 0.75rem;
	}

	.queue-list {
		display: grid;
		gap: 0.75rem;
	}

	.queue-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.queue-controls {
		display: grid;
		flex: 0 0 3rem;
	}

	.queue-row :global(.sideways-root) {
		flex: 1;
		min-width: 0;
	}

	.queue-thumbnail {
		flex: 1;
		min-width: 0;
		margin: 0;
		background: var(--surface-container-highest);
	}

	.queue-empty {
		opacity: 0.7;
	}
</style>
