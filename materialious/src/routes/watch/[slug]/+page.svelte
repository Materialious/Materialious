<script lang="ts">
	import { deleteUnsubscribe, postSubscribe } from '$lib/Api/index.js';
	import PageLoading from '$lib/PageLoading.svelte';
	import Player from '$lib/Player.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { cleanNumber, numberWithCommas } from '$lib/misc.js';
	import { activePage } from '../../../store.js';

	export let data;

	activePage.set(null);

	async function toggleSubscribed() {
		if (data.subscribed) {
			await deleteUnsubscribe(data.video.authorId);
		} else {
			await postSubscribe(data.video.authorId);
		}

		data.subscribed = !data.subscribed;
	}
</script>

{#if data}
	<div class="grid">
		<div class="s12 m12 l10">
			{#key data.video.videoId}
				<Player {data} />
			{/key}

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
				<button
					on:click={toggleSubscribed}
					class:inverse-surface={!data.subscribed}
					class:border={data.subscribed}
				>
					{#if !data.subscribed}
						Subscribe
					{:else}
						Unsubscribe
					{/if}
				</button>
				<div class="max"></div>
				<nav class="no-space m l">
					<button style="cursor: default;" class="border left-round">
						<i class="small">thumb_up</i>
						<span>{cleanNumber(data.returnYTDislikes.likes)}</span>
					</button>
					<button style="cursor: default;" class="border right-round">
						<i class="small">thumb_down_alt</i>
						<span>{cleanNumber(data.returnYTDislikes.dislikes)}</span>
					</button>
				</nav>
				<button class="border m l" data-ui="#share"
					><i>share</i> Share
					<menu class="left no-wrap" id="share" data-ui="#share">
						<a
							class="row"
							href="#copy"
							on:click={async () =>
								await navigator.clipboard.writeText(
									`${import.meta.env.VITE_DEFAULT_FRONTEND_URL}/watch/${data.video.videoId}`
								)}
						>
							<div class="min">Copy Materialious link</div></a
						><a
							href="#copy"
							class="row"
							on:click={async () =>
								await navigator.clipboard.writeText(
									`https://redirect.invidious.io/watch?v=${data.video.videoId}`
								)}
						>
							<div class="min">Copy Invidious redirect link</div></a
						><a
							class="row"
							href="#copy"
							on:click={async () =>
								await navigator.clipboard.writeText(
									`https://www.youtube.com/watch?v=${data.video.videoId}`
								)}
						>
							<div class="min">Copy Youtube link</div></a
						></menu
					></button
				>
			</nav>

			<nav class="no-space s">
				<button style="cursor: default;" class="border left-round">
					<i class="small">thumb_up</i>
					<span>{cleanNumber(data.returnYTDislikes.likes)}</span>
				</button>
				<button style="cursor: default;" class="border right-round">
					<i class="small">thumb_down_alt</i>
					<span>{cleanNumber(data.returnYTDislikes.dislikes)}</span>
				</button>
			</nav>

			<article class="medium scroll">
				<p class="bold">
					{numberWithCommas(data.video.viewCount)} views • {data.video.publishedText}
				</p>
				<p style="white-space: pre-line;word-wrap: break-word;">{data.video.description}</p>
			</article>

			<div class="space"></div>
			{#if data.comments.comments}
				<h6>{numberWithCommas(data.comments.commentCount)} comments</h6>
				{#each data.comments.comments as comment}
					<div class="comment">
						<img class="circle small" src={comment.authorThumbnails[1].url} alt="comment profile" />
						<div>
							<div class="row">
								<p>
									<span class:bold={true} class:channel-owner={comment.authorIsChannelOwner}
										>{comment.author}</span
									>
									<span class="secondary-text">{comment.publishedText}</span>
								</p>
								{#if comment.isPinned}
									<i>push_pin</i>
								{/if}
								{#if comment.isEdited}
									<i>edit</i>
								{/if}
							</div>
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
				<button class="margin">Load more</button>
			{:else}
				<h6>Comments disabled</h6>
			{/if}
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

		.channel-owner {
			background-color: var(--primary);
			padding: 0 0.5em;
			border-radius: 1em;
			color: var(--surface-variant);
		}

		@media screen and (max-width: 1646px) {
			.grid {
				padding: 0;
			}
		}
	</style>
{:else}
	<PageLoading />
{/if}
