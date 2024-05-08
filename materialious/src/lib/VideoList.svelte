<script lang="ts">
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from './Api/model';
	import Thumbnail from './Thumbnail.svelte';

	export let videos: VideoBase[] | Video[] | Notification[] | PlaylistPageVideo[] = [];
	export let oneItemPerRow: boolean = false;
	export let playlistId: string = '';

	let hiddenVideos: string[] = [];
</script>

<div class="page right active">
	<div class="space"></div>
	<div class="grid">
		{#each videos as video}
			{#if !hiddenVideos.includes(video.videoId)}
				<div class={`s12 m${oneItemPerRow ? '12' : '6'} l${oneItemPerRow ? '12' : '2'}`}>
					<article class="no-padding" style="height: 100%;">
						<Thumbnail
							on:videoHidden={() => (hiddenVideos = [...hiddenVideos, video.videoId])}
							{video}
							{playlistId}
						/>
					</article>
				</div>
			{/if}
		{/each}
	</div>
</div>
