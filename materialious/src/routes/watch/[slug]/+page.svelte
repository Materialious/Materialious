<script lang="ts">
	import { deleteUnsubscribe, getComments, postSubscribe } from '$lib/Api/index.js';
	import Comment from '$lib/Comment.svelte';
	import PageLoading from '$lib/PageLoading.svelte';
	import Player from '$lib/Player.svelte';
	import Thumbnail from '$lib/Thumbnail.svelte';
	import { cleanNumber, numberWithCommas } from '$lib/misc.js';
	import { get } from 'svelte/store';
	import { activePage, playerListenByDefault } from '../../../store.js';

	export let data;

	let comments = data.comments;

	activePage.set(null);

	async function loadMoreComments() {
		if (!comments) {
			return;
		}

		const loadedComments = await getComments(data.video.videoId, {
			continuation: comments?.continuation
		});

		comments.continuation = loadedComments.continuation;

		comments.comments = [...comments.comments, ...loadedComments.comments];
	}

	async function toggleSubscribed() {
		if (data.subscribed) {
			await deleteUnsubscribe(data.video.authorId);
		} else {
			await postSubscribe(data.video.authorId);
		}

		data.subscribed = !data.subscribed;
	}

	let audioMode = get(playerListenByDefault);
	let currentTime: number;
	let seekTo: (time: number) => void;
</script>

{#if data}
	<div class="grid">
		<div class="s12 m12 l10">
			{#key data.video.videoId}
				<Player {data} {audioMode} bind:seekTo bind:currentTime />
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
				{#if data.returnYTDislikes}
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
				{/if}
				<button on:click={() => (audioMode = !audioMode)} class:border={!audioMode}>
					<i>headphones</i>
					<span>Audio only </span>
				</button>
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

			{#if data.returnYTDislikes}
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
			{/if}

			<article class="medium scroll">
				<p class="bold">
					{numberWithCommas(data.video.viewCount)} views • {data.video.publishedText}
				</p>
				<p style="white-space: pre-line;word-wrap: break-word;">{data.content.description}</p>
				{#if data.content}
					{#if data.content.timestamps.length > 0}
						<h6 style="margin-bottom: .3em;">Chapters</h6>
						{#each data.content.timestamps as timestamp}
							<button
								on:click={() => seekTo(timestamp.time)}
								class="timestamps"
								class:primary={timestamp.time <= currentTime}
								>{timestamp.timePretty}
								{#if !timestamp.title.startsWith('-')}
									-
								{/if}
								{timestamp.title}</button
							>
						{/each}
					{/if}
				{/if}
			</article>

			<div class="space"></div>
			{#if comments && comments.comments.length > 0}
				<h6>{numberWithCommas(comments.commentCount)} comments</h6>
				{#each comments.comments as comment}
					<Comment {comment} videoId={data.video.videoId}></Comment>
				{/each}
				{#if comments.continuation}
					<button on:click={loadMoreComments} class="margin">Load more</button>
				{/if}
			{:else}
				<h6>Comments disabled</h6>
			{/if}
		</div>
		<div class="s12 m12 l2">
			{#if data.video.recommendedVideos}
				{#each data.video.recommendedVideos as recommendedVideo}
					<article class="no-padding">
						<Thumbnail video={recommendedVideo} />
					</article>
				{/each}
			{/if}
		</div>
	</div>
{:else}
	<PageLoading />
{/if}

<style>
	:root {
		--plyr-color-main: var(--primary);
	}

	.grid {
		padding: 1em 10em;
	}

	@media screen and (max-width: 1646px) {
		.grid {
			padding: 0;
		}
	}

	.timestamps {
		margin-left: 0;
		margin-bottom: 0.4em;
		display: block;
		background-color: var(--secondary-container);
		color: var(--on-secondary-container);
	}
</style>
