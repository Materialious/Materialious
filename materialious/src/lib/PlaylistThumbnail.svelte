<script lang="ts">
	import { onMount } from 'svelte';
	import type { Playlist } from './Api/model';
	import { truncate } from './misc';

	export let playlist: Playlist;

	let loading = true;
	let loaded = false;
	let failed = false;

	let img: HTMLImageElement;

	onMount(() => {
		img = new Image();
		if (playlist.videos.length > 0) {
			img.src = playlist.videos[0].videoThumbnails[4].url;
		} else {
			img.src = playlist.playlistThumbnail;
		}

		img.onload = () => {
			loaded = true;
			loading = false;
		};
		img.onerror = () => {
			loading = false;
			failed = true;
		};
	});
</script>

<a
	href={`/playlist/${playlist.playlistId}`}
	style="width: 100%; overflow: hidden;min-height:100px;"
	class="wave"
>
	{#if playlist.videoCount > 0}
		{#if loading}
			<progress class="circle"></progress>
		{:else}
			<img
				class="responsive"
				style="max-width: 100%;height: 100%;"
				src={img.src}
				alt="Thumbnail for playlist"
			/>
		{/if}
	{/if}
	<div class="absolute right bottom small-margin black white-text small-text thumbnail-corner">
		{playlist.videoCount} videos
	</div>
</a>

<div class="small-padding">
	<nav class="no-margin">
		<div class="max">
			<a href={`/playlist/${playlist.playlistId}`}
				><div class="bold">{truncate(playlist.title)}</div></a
			>
			<div>
				<a href={`/channel/${playlist.authorId}`}>{playlist.author}</a>
			</div>
		</div>
	</nav>
</div>
