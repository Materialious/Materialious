<script lang="ts">
	import { getComments } from '$lib/api';
	import { type Comment, type Comments } from '$lib/api/model';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { interfaceLowBandwidthMode } from '$lib/store';
	import { numberWithCommas } from '$lib/time';
	import CommentSelf from './Comment.svelte';

	interface Props {
		comment: Comment;
		videoId: string;
	}

	let { comment, videoId }: Props = $props();

	let replies: Comments | undefined = $state(undefined);

	const replyText: string = comment.replies?.replyCount > 1 ? 'replies' : 'reply';

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
		const replacement = `<a href="/watch/${videoId}?time=$2" data-sveltekit-preload-data="off" class="link">$3 $4</a>`;

		const processedHtml = html.replace(regex, replacement);

		return processedHtml;
	}
</script>

<div class="comment">
	{#if !$interfaceLowBandwidthMode}
		<div class="comment-header">
			<img
				class="circle small"
				src={proxyGoogleImage(getBestThumbnail(comment.authorThumbnails))}
				alt="comment profile"
			/>
			<div class="comment-info">
				<a href={`/channel/${comment.authorId}`} class="author">
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
		<div style="margin-left: 5em;">
			{#each replies.comments as reply}
				<CommentSelf comment={reply} {videoId} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.comment {
		display: flex;
		flex-direction: column;
		margin-bottom: 1em;
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
