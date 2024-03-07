<script lang="ts">
	import type { Video, VideoBase } from './Api/model';
	import { truncate } from './misc';

	export let video: VideoBase | Video;

	function videoLength(lengthSeconds: number): string {
		const hours = Math.floor(lengthSeconds / 3600);
		const minutes = Math.floor((lengthSeconds % 3600) / 60);
		const seconds = lengthSeconds % 60;

		return `${hours}:${minutes}:${seconds}`;
	}
</script>

<article class="no-padding transparent">
	<a
		class="wave"
		style="width: 100%; height: 155px; overflow: hidden;"
		href={`/watch/${video.videoId}`}
		><img
			class="responsive"
			style="object-fit: crop;"
			src={video.videoThumbnails[3].url}
			alt="Thumbnail for video"
		/>
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
		<nav>
			<div class="max">
				<div class="bold">{truncate(video.title)}</div>
				<div>
					{video.author}{#if !('publishedText' in video)}
						&nbsp;• {video.viewCountText}{/if}
				</div>
				{#if 'publishedText' in video}
					<div>
						{video.viewCountText} • {video.publishedText}
					</div>{/if}
			</div>
			<button class="circle transparent" data-ui="#menu-1"
				><i>more_vert</i><menu class="left no-wrap" id="menu-1" data-ui="#menu-1"
					><a>Save to paylist</a>
					<a>Download</a></menu
				></button
			>
		</nav>
	</div>
</article>
