<script lang="ts">
	import { resolveWatchPath } from '#lib/paths';
	import { _ } from '#lib/i18n/index';
	import { goToNextVideo, goToPreviousVideo } from '#lib/player/index';
	import { playerState, videoQueueStore, type PlayerState } from '#lib/store';
	import { truncate } from '#lib/utils';
	import Author from '#lib/components/Author.svelte';

	let { activePlayer }: { activePlayer: PlayerState } = $props();
	let showQueueNavigation = $derived(
		Boolean(activePlayer.data.playlistId) || $videoQueueStore.length > 0
	);
</script>

<div>
	<nav class="pip-header">
		<a
			class="max pip-title"
			href={resolveWatchPath(activePlayer.data.video.videoId, activePlayer.data.playlistId ?? undefined)}
		>
			<h6>{truncate(activePlayer.data.video.title, 25)}</h6>
		</a>
		<button
			class="circle surface-container-highest pip-close-mobile"
			aria-label="Close mini-player"
			title="Close mini-player"
			onclick={() => playerState.set(undefined)}
		>
			<i>close</i>
		</button>
	</nav>
</div>

<nav class="pip-author">
	<div class="pip-author-content">
		<Author channel={activePlayer.data.video} hideSubscribe={true} />
	</div>
	<button
		class="circle surface-container-highest pip-close-desktop"
		aria-label="Close mini-player"
		title="Close mini-player"
		onclick={() => playerState.set(undefined)}
	>
		<i>close</i>
	</button>
</nav>

{#if showQueueNavigation}
	<nav class="pip-actions">
		<button
			class="circle surface-container-highest"
			title={$_('playlist.previous')}
			onclick={() => goToPreviousVideo(activePlayer.data.playlistId)}
		>
			<i>skip_previous</i>
		</button>
		<div class="max"></div>
		<button
			class="circle surface-container-highest"
			title={$_('playlist.next')}
			onclick={() => goToNextVideo(activePlayer.data.video, activePlayer.data.playlistId)}
		>
			<i>skip_next</i>
		</button>
	</nav>
{/if}

<style>
	.pip-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		width: 100%;
	}

	.pip-author {
		display: flex;
		align-items: center;
		width: 100%;
		margin-block: 0.25rem;
	}

	.pip-author-content {
		flex: 1 1 0;
		min-width: 0;
		overflow: hidden;
	}

	.pip-author > button {
		flex: 0 0 auto;
	}

	.pip-title {
		display: block;
		flex: 1 1 auto;
		min-width: 0;
		color: var(--on-surface-variant);
		cursor: pointer;
		text-align: left;
		text-decoration: none;
	}

	.pip-title h6 {
		margin: 0;
		text-align: left;
	}

	.pip-header {
		display: flex;
		justify-content: flex-start;
		text-align: left;
	}

	.pip-close-mobile {
		display: none;
	}

	@media only screen and (max-width: 993px) {
		.pip-title h6 {
			font-size: 1.15em;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.pip-author :global(nav),
		.pip-author :global(a),
		.pip-author :global(nav div) {
			min-width: 0;
		}

		.pip-author :global(img) {
			width: 2rem;
			height: 2rem;
		}

		.pip-author :global(p) {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.pip-close-desktop {
			display: none;
		}

		.pip-close-mobile {
			display: inline-flex;
			flex: 0 0 auto;
		}

		.pip-close-mobile,
		.pip-actions button {
			width: 2rem;
			height: 2rem;
		}
	}
</style>
