<script lang="ts">
	import { onMount } from 'svelte';
	import type { Video, VideoBase } from './Api/model';
	import { cleanNumber, truncate } from './misc';

	export let video: VideoBase | Video;

	function videoLength(lengthSeconds: number): string {
		const hours = Math.floor(lengthSeconds / 3600);
		const minutes = Math.floor((lengthSeconds % 3600) / 60);
		const seconds = lengthSeconds % 60;

		return `${hours}:${minutes}:${seconds}`;
	}

	let loading = true;
	let loaded = false;
	let failed = false;

	onMount(() => {
		const img = new Image();
		img.src = video.videoThumbnails[3].url;

		img.onload = () => {
			loading = false;
			loaded = true;
		};
		img.onerror = () => {
			loading = false;
			failed = true;
		};
	});
</script>

<article class="no-padding transparent" style="width: 100%;">
	<a
		class="wave"
		style="width: 100%;height: 155px; overflow: hidden;"
		href={`/watch/${video.videoId}`}
	>
		{#if loading}
			<progress class="circle"></progress>
		{:else if loaded}
			<img
				class="responsive"
				style="object-fit: crop;"
				src={video.videoThumbnails[3].url}
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
		{#if localStorage.getItem(video.videoId)}
			<progress value={localStorage.getItem(video.videoId)} max={video.lengthSeconds}></progress>
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
					</div>{/if}
			</div>
		</nav>
	</div>
</article>
