<script lang="ts">
	import { onMount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import { removePlaylistVideo } from './Api';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from './Api/model';
	import Thumbnail from './Thumbnail.svelte';
	import { authStore } from './store';

	export let videos: VideoBase[] | Video[] | Notification[] | PlaylistPageVideo[] = [];
	export let playlistId: string = '';
	export let playlistAuthor: string = '';

	let hiddenVideos: string[] = [];
	let auth = get(authStore);
	let largeCol = '2';

	async function removePlaylistItem(indexId: string, videoId: string) {
		if (!playlistId) return;
		await removePlaylistVideo(playlistId, indexId);
		hiddenVideos = [...hiddenVideos, videoId];
	}

	onMount(() => {
		addEventListener('resize', () => {
			if (innerWidth <= 1750) {
				largeCol = '6';
			} else {
				largeCol = '2';
			}
		});
	});
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each videos as video}
			{#if !hiddenVideos.includes(video.videoId)}
				<div class="s12 m6 l{largeCol}">
					<article class="no-padding" style="height: 100%;">
						<Thumbnail
							on:videoHidden={() => (hiddenVideos = [...hiddenVideos, video.videoId])}
							{video}
							{playlistId}
						/>
						{#if auth && decodeURIComponent(auth.username) === playlistAuthor && 'indexId' in video}
							<div class="right-align" style="margin: 1em .5em;">
								<button
									on:click={async () => removePlaylistItem(video.indexId, video.videoId)}
									class="tertiary circle small"
								>
									<i>delete</i>
									<div class="tooltip">{$_('delete')}</div>
								</button>
							</div>
						{/if}
					</article>
				</div>
			{/if}
		{/each}
	</div>
</div>
