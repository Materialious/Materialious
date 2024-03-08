<script lang="ts">
	import humanNumber from 'human-number';

	import { get } from 'svelte/store';

	import Plyr from 'plyr';
	import 'plyr/dist/plyr.css';

	import Thumbnail from '$lib/Thumbnail.svelte';
	import { numberWithCommas } from '$lib/misc.js';
	import { onMount } from 'svelte';

	import { invidiousInstance } from '../../../store';

	export let data;

	const cleanRound = (number: number) => Number.parseFloat(number.toString()).toFixed(1);

	$: video = data.video;
	let player;
	onMount(() => {
		player = new Plyr('#player');
		player.source = {
			type: 'video',
			previewThumbnails: {
				src: data.video.videoThumbnails[0].url
			},
			poster: data.video.videoThumbnails[0].url,
			tracks: data.video.captions.map((caption) => {
				return {
					kind: 'captions',
					label: caption.label,
					srcLang: caption.languageCode,
					src: `${get(invidiousInstance)}${caption.url}`
				};
			}),
			sources: data.video.formatStreams.map((format) => {
				return { src: format.url, size: Number(format.size.split('x')[1]), type: format.type };
			})
		};
	});
</script>

<div class="grid">
	<div class="s12 m12 l10">
		<video width="100%" id="player" playsinline controls> </video>
		<h5>{data.video.title}</h5>

		<nav>
			<a href={`/channel/${data.video.authorId}`}>
				<nav>
					<img
						class="circle large"
						src={data.video.authorThumbnails[2].url}
						alt="Channel profile"
					/>
					<div>
						<p class="bold">{data.video.author}</p>
						<p>{data.video.subCountText}</p>
					</div>
				</nav>
			</a>
			<button class="inverse-surface">Subscribe</button>
			<div class="max"></div>
			<nav class="no-space m l">
				<button style="cursor: default;" class="border left-round">
					<i class="small">thumb_up</i>
					<span>{humanNumber(data.returnYTDislikes.likes, cleanRound)}</span>
				</button>
				<button style="cursor: default;" class="border right-round">
					<i class="small">thumb_down_alt</i>
					<span>{humanNumber(data.returnYTDislikes.dislikes, cleanRound)}</span>
				</button>
			</nav>
			<button class="border m l" data-ui="#share"
				><i>share</i> Share
				<menu class="left no-wrap" id="share" data-ui="#share">
					<a class="row"> <div class="min">Copy Materialious link</div></a><a class="row">
						<div class="min">Copy Invidious redirect link</div></a
					><a class="row"> <div class="min">Copy Youtube link</div></a></menu
				></button
			>
		</nav>

		<nav class="no-space s">
			<button style="cursor: default;" class="border left-round">
				<i class="small">thumb_up</i>
				<span>{humanNumber(data.returnYTDislikes.likes, cleanRound)}</span>
			</button>
			<button style="cursor: default;" class="border right-round">
				<i class="small">thumb_down_alt</i>
				<span>{humanNumber(data.returnYTDislikes.dislikes, cleanRound)}</span>
			</button>
		</nav>

		<article class="medium scroll">
			<p class="bold">
				{numberWithCommas(data.video.viewCount)} views • {data.video.publishedText}
			</p>
			<p style="white-space: pre-line;word-wrap: break-word;">{data.video.description}</p>
		</article>

		<div class="space"></div>
		<h6>{numberWithCommas(data.comments.commentCount)} comments</h6>
		{#each data.comments.comments as comment}
			<div class="comment">
				<img class="circle small" src={comment.authorThumbnails[1].url} alt="comment profile" />
				<div>
					<p>
						<span class="bold">{comment.author}</span>
						<span class="secondary-text">{comment.publishedText}</span>
					</p>
					<p>
						{comment.content}
					</p>
					<div style="display: flex;">
						<p><i>thumb_up</i> {numberWithCommas(comment.likeCount)}</p>
						{#if comment.creatorHeart}
							<div>
								<img
									class="circle"
									style="width: 25px; height: 25px"
									src={comment.creatorHeart.creatorThumbnail}
									alt="Creator profile"
								/>
								<i
									style="font-size: 20px;margin-left: 5px;"
									class="absolute left red-text bottom fill">favorite</i
								>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
	<div class="s12 m12 l2">
		{#each data.video.recommendedVideos as recommendedVideo}
			<Thumbnail video={recommendedVideo} />
		{/each}
	</div>
</div>

<style>
	:root {
		--plyr-color-main: var(--primary);
	}

	.comment {
		display: flex;
	}

	.comment img {
		margin: 0.5em 1em 0 1em;
	}

	.grid {
		padding: 1em 10em;
	}

	@media screen and (max-width: 1646px) {
		.grid {
			padding: 0;
		}
	}
</style>
