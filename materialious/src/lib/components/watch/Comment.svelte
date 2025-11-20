<script lang="ts">
	import { resolve } from '$app/paths';
	import { getComments } from '$lib/api';
	import { type Comment, type Comments } from '$lib/api/model';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { numberWithCommas } from '$lib/numbers';
	import { interfaceLowBandwidthMode } from '$lib/store';
	import { onMount } from 'svelte';
	import CommentSelf from './Comment.svelte';
	import { insecureRequestImageHandler } from '$lib/misc';
	import { _ } from '$lib/i18n';

	interface Props {
		comment: Comment;
		videoId: string;
		isSubComp?: boolean;
	}

	let { comment, videoId, isSubComp = false }: Props = $props();

	let replies: Comments | undefined = $state(undefined);

	const replyText: string = comment.replies?.replyCount > 1 ? $_('replies') : $_('reply');

	async function loadReplies(continuation: string) {
		try {
			replies = await getComments(videoId, {
				continuation: continuation,
				sort_by: 'top',
				source: 'youtube'
			});
		} catch {}
	}

	function commentTimestamps(html: string): string {
		const regex =
			/<a href="([^"]+)" data-onclick="jump_to_time" data-jump-time="(\d+)">([^<]+)<\/a>\s*(.+)/g;
		const replacement = `<a href=${resolve(`/watch/[videoId]?time=$2`, { videoId: videoId })} data-sveltekit-preload-data="off" class="link">$3 $4</a>`;

		const processedHtml = html.replace(regex, replacement);

		return processedHtml;
	}

	let userPfp = $state('');
	onMount(async () => {
		if ($interfaceLowBandwidthMode) return;
		const img = await insecureRequestImageHandler(
			proxyGoogleImage(getBestThumbnail(comment.authorThumbnails))
		);

		img.onload = () => {
			userPfp = img.src;
		};
	});
</script>

<article class="comment" class:border={!isSubComp}>
	{#if !$interfaceLowBandwidthMode}
		<div class="comment-header">
			{#if userPfp}
				<img loading="lazy" class="circle small" src={userPfp} alt="comment profile" />
			{:else}
				<progress class="circle"></progress>
			{/if}
			<div class="comment-info">
				<a href={resolve(`/channel/[authorId]`, { authorId: comment.authorId })} class="author">
					<span class="bold" class:channel-owner={comment.authorIsChannelOwner}>
						{comment.author}
					</span>
					<span class="secondary-text">{comment.publishedText}</span>
				</a>
				<p class="no-margin">
					{@html commentTimestamps(comment.contentHtml)}
				</p>
				<div class="comment-actions">
					<p class="no-margin no-padding"><i>thumb_up</i> {numberWithCommas(comment.likeCount)}</p>
					{#if comment.replies && !replies}
						<button
							onclick={async () => loadReplies(comment.replies.continuation)}
							class="transparent replies"
						>
							<i class="white-text">expand_more</i>
							<span class="white-text">{comment.replies.replyCount} {replyText}</span>
						</button>
					{:else if replies}
						<button onclick={() => (replies = undefined)} class="transparent replies">
							<i class="white-text">expand_less</i>
							<span class="white-text">Hide {replyText}</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if replies}
		{#each replies.comments as reply}
			<CommentSelf comment={reply} {videoId} isSubComp={true} />
		{/each}
	{/if}
</article>

<style>
	.comment {
		display: flex;
		flex-direction: column;
		white-space: pre-line;
	}

	.comment-header {
		display: flex;
		align-items: flex-start;
	}

	.comment-header img {
		margin: 0;
		border-radius: 50%;
	}

	.comment-info {
		display: flex;
		flex-direction: column;
		margin-left: 1em;
	}

	.author {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		font-size: 14px;
	}

	.comment-actions {
		display: flex;
		align-items: center;
		gap: 15px;
		margin-top: 5px;
		font-size: 14px;
	}

	a {
		justify-content: start;
	}

	.replies {
		padding: 0.1em;
	}
</style>
