<script lang="ts">
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { numberWithCommas } from '$lib/misc.js';
	import humanNumber from 'human-number';

	export let data;

	const cleanRound = (number: number) => Number.parseFloat(number.toString()).toFixed(1);
</script>

<div class="grid large-margin">
	<div class="s12 m12 l10">
		<h5>{data.video.title}</h5>

		<nav>
			<img class="circle large" src={data.video.authorThumbnails[2].url} alt="Channel profile" />
			<div>
				<p class="bold">{data.video.author}</p>
				<p>{data.video.subCountText}</p>
			</div>
			<button class="inverse-surface">Subscribe</button>
			<div class="max"></div>
			<nav class="no-space">
				<button style="cursor: default;" class="border left-round">
					<i class="small">thumb_up</i>
					<span>{humanNumber(data.returnYTDislikes.likes, cleanRound)}</span>
				</button>
				<button style="cursor: default;" class="border right-round">
					<i class="small">thumb_down_alt</i>
					<span>{humanNumber(data.returnYTDislikes.dislikes, cleanRound)}</span>
				</button>
			</nav>
			<button class="border" data-ui="#share"
				><i>share</i> Share
				<menu class="left no-wrap" id="share" data-ui="#share">
					<a class="row"> <div class="min">Copy Materialious link</div></a><a class="row">
						<div class="min">Copy Invidious redirect link</div></a
					><a class="row"> <div class="min">Copy Youtube link</div></a></menu
				></button
			>
		</nav>

		<article>
			<p>{numberWithCommas(data.video.viewCount)} views • {data.video.publishedText}</p>
			<p style="white-space: pre-line;word-wrap: break-word;">{data.video.description}</p>
		</article>
	</div>
	<div class="s12 m12 l2">
		{#each data.video.recommendedVideos as recommendedVideo}
			<Thumbnail video={recommendedVideo} />
		{/each}
	</div>
</div>
