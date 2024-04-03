<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { playerSavePlaybackPosition } from '../store';
	import type { Notification, PlaylistPageVideo, Video, VideoBase } from './Api/model';
	import { cleanNumber, truncate, videoLength } from './misc';

	export let video: VideoBase | Video | Notification | PlaylistPageVideo;
	export let playlistId: string = '';

	let watchUrl = `/watch/${video.videoId}` + (playlistId ? `?playlist=${playlistId}` : '');

	let loading = true;
	let loaded = false;
	let failed = false;

	let img: HTMLImageElement;

	let progress: string | null;
	if (get(playerSavePlaybackPosition)) {
		try {
			progress = localStorage.getItem(`v_${video.videoId}`);
		} catch {
			progress = null;
		}
	} else {
		progress = null;
	}

	onMount(() => {
		img = new Image();
		img.src = video.videoThumbnails[4].url;

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
	class="wave"
	style="width: 100%; overflow: hidden;min-height:100px;"
	href={watchUrl}
	data-sveltekit-preload-data="off"
>
	{#if loading}
		<progress class="circle"></progress>
	{:else if loaded}
		<img
			class="responsive"
			style="max-width: 100%;height: 100%;"
			src={img.src}
			alt="Thumbnail for video"
		/>
	{:else}
		<p>Failed to load image</p>
	{/if}
	{#if progress}
		<progress
			class="absolute right bottom"
			style="z-index: 1;"
			value={progress}
			max={video.lengthSeconds}
		></progress>
	{/if}
	{#if !('liveVideo' in video) || !video.liveVideo}
		{#if video.lengthSeconds !== 0}
			<div class="absolute right bottom small-margin black white-text small-text thumbnail-corner">
				&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
			</div>
		{/if}
	{:else}
		<div class="absolute right bottom small-margin red white-text small-text thumbnail-corner">
			LIVE
		</div>
	{/if}
</a>
<div class="small-padding">
	<nav class="no-margin">
		<div class="max">
			<a href={watchUrl}><div class="bold">{truncate(video.title)}</div></a>
			<div>
				<a href={`/channel/${video.authorId}`}>{video.author}</a
				>{#if !('publishedText' in video) && 'viewCountText' in video}
					&nbsp;• {video.viewCountText}{/if}
			</div>
			{#if 'publishedText' in video}
				<div>
					{cleanNumber(video.viewCount)} • {video.publishedText}
				</div>
			{/if}
		</div>
	</nav>
</div>
