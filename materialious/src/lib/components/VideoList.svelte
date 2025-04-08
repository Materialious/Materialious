<script lang="ts">
	import Thumbnail from '$lib/components/Thumbnail.svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { removePlaylistVideo } from '../api';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from '../api/model';
	import { authStore } from '../store';
	import ContentColumn from './ContentColumn.svelte';

	interface Props {
		videos?: VideoBase[] | Video[] | Notification[] | PlaylistPageVideo[];
		playlistId?: string;
		playlistAuthor?: string;
	}

	let { videos = [], playlistId = '', playlistAuthor = '' }: Props = $props();

	let auth = get(authStore);

	async function removePlaylistItem(indexId: string, videoId: string) {
		if (!playlistId) return;
		await removePlaylistVideo(playlistId, indexId);
	}
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each videos as video}
				<ContentColumn>
					<article class="no-padding" style="height: 100%;">
						<Thumbnail
							{video}
							{playlistId}
						/>
						{#if auth && decodeURIComponent(auth.username) === playlistAuthor && 'indexId' in video}
							<div class="right-align" style="margin: 1em .5em;">
								<button
									onclick={async () => removePlaylistItem(video.indexId, video.videoId)}
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
