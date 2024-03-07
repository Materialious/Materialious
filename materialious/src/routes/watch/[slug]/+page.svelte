<script lang="ts">
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { numberWithCommas } from '$lib/misc.js';

	export let data;
</script>

<div class="grid large-margin">
	<div class="s12 m10 l10">
		<h5>{data.video.title}</h5>
		<article>
			<p>{numberWithCommas(data.video.viewCount)} views • {data.video.publishedText}</p>
			<p style="white-space: pre-line">{data.video.description}</p>
		</article>
	</div>
	<div class="m4 l2">
		{#each data.video.recommendedVideos as recommendedVideo}
			<Thumbnail video={recommendedVideo} />
		{/each}
	</div>
</div>
