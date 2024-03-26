<script lang="ts">
	import { onMount } from 'svelte';
	import type { Notification, Video, VideoBase } from './Api/model';
	import { cleanNumber, truncate, videoLength } from './misc';

	export let video: VideoBase | Video | Notification;

	let loading = true;
	let loaded = false;
	let failed = false;

	onMount(() => {
		const img = new Image();
		img.src = video.videoThumbnails[3].url;

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
	href={`/watch/${video.videoId}`}
>
	{#if loading}
		<progress class="circle"></progress>
	{:else if loaded}
		<img
			class="responsive"
			style="max-width: 100%;height: 100%;"
			src={video.videoThumbnails[4].url}
			alt="Thumbnail for video"
		/>
	{:else}
		<p>Failed to load image</p>
	{/if}
	{#if !('liveVideo' in video) || !video.liveVideo}
		<div class="absolute right bottom small-margin black white-text small-text">
			&nbsp;{videoLength(video.lengthSeconds)}&nbsp;
		</div>
	{:else}
		<div
			class="absolute right bottom small-margin red white-text small-text"
			style="padding: 0 1em;"
		>
			LIVE
		</div>
	{/if}
</a>
<div class="small-padding">
	{#if localStorage.getItem(`v_${video.videoId}`)}
		<progress value={localStorage.getItem(`v_${video.videoId}`)} max={video.lengthSeconds}
		></progress>
	{/if}
	<nav class="no-margin">
		<div class="max">
			<a href={`/watch/${video.videoId}`}><div class="bold">{truncate(video.title)}</div></a>
			<div>
				<a href={`/channel/${video.authorId}`}>{video.author}</a>{#if !('publishedText' in video)}
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
