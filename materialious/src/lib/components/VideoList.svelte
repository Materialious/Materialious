<script lang="ts">
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import { _ } from '$lib/i18n';
	import { removePlaylistVideo } from '../api';
	import type { PlaylistPageVideo, Video, VideoBase } from '../api/model';
	import { authStore, feedLastItemId } from '../store';
	import ContentColumn from './ContentColumn.svelte';
	import { onMount } from 'svelte';

	interface Props {
		videos?: (VideoBase | Video | PlaylistPageVideo)[];
		playlistId?: string;
		playlistAuthor?: string;
	}

	let { videos = [], playlistId = '', playlistAuthor = '' }: Props = $props();

	async function removePlaylistItem(indexId: string) {
		if (!playlistId) return;
		await removePlaylistVideo(playlistId, indexId);
	}

	onMount(() => {
		if ($feedLastItemId)
			document
				.getElementById($feedLastItemId)
				?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
	});
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each videos as video}
			<ContentColumn>
				<article
					class="no-padding"
					style="height: 100%;"
					id={video.videoId}
					onclick={() => feedLastItemId.set(video.videoId)}
				>
					<Thumbnail {video} {playlistId} />
					{#if $authStore && decodeURIComponent($authStore.username) === playlistAuthor && 'indexId' in video}
						<div class="right-align" style="margin: 1em .5em;">
							<button
								onclick={async () => removePlaylistItem(video.indexId)}
								class="tertiary circle small"
							>
								<i>delete</i>
								<div class="tooltip">{$_('delete')}</div>
							</button>
						</div>
					{/if}
				</article>
			</ContentColumn>
		{/each}
	</div>
</div>
