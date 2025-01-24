<script lang="ts">
	import { getComments } from '$lib/api';
	import { type Comment, type Comments } from '$lib/api/model';
	import { getBestThumbnail, numberWithCommas, proxyGoogleImage } from '$lib/misc';
	import { interfaceLowBandwidthMode } from '$lib/store';
	import { _ } from 'svelte-i18n';

	export let comment: Comment;
	export let videoId: string;

	let replies: Comments | undefined = undefined;

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
		<img
			class="circle small"
			src={proxyGoogleImage(getBestThumbnail(comment.authorThumbnails))}
			alt="comment profile"
		/>
	{/if}
	<div>
		<div class="row">
			<a href={`/channel/${comment.authorId}`}>
				<p class="no-margin">
					<span class="bold" class:channel-owner={comment.authorIsChannelOwner}
						>{comment.author}</span
					>
					<span class="secondary-text">{comment.publishedText}</span>
				</p>
			</a>
			{#if comment.isPinned}
				<i>push_pin</i>
			{/if}
			{#if comment.isEdited}
				<i>edit</i>
			{/if}
		</div>
		<p class="no-margin">
			{@html commentTimestamps(comment.contentHtml)}
		</p>
		<div style="display: flex;">
			<p><i>thumb_up</i> {numberWithCommas(comment.likeCount)}</p>
			{#if comment.creatorHeart}
				<div>
					<img
						class="circle"
						style="width: 25px; height: 25px"
						src={proxyGoogleImage(comment.creatorHeart.creatorThumbnail)}
						alt="Creator profile"
					/>
					<i style="font-size: 20px;margin-left: 5px;" class="absolute left red-text bottom fill"
						>favorite</i
					>
				</div>
			{/if}
		</div>

		{#if replies}
			{#each replies.comments as reply}
				<svelte:self comment={reply} {videoId} />
			{/each}
		{/if}

		{#if comment.replies && !replies}
			<button
				on:click={async () => loadReplies(comment.replies.continuation)}
				class="transparent replies"
			>
				<i class="primary-text">expand_more</i>
				<span class="primary-text">{comment.replies.replyCount} {$_('replies')}</span>
			</button>
		{:else if replies}
			<button on:click={() => (replies = undefined)} class="transparent replies">
				<i class="primary-text">expand_less</i>
				<span class="primary-text">{$_('hideReplies')}</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.comment img {
		margin: 0.5em 1em 0 1em;
	}

	.comment {
		display: flex;
		margin-bottom: 0.8em;
		white-space: pre-line;
	}

	.channel-owner {
		background-color: var(--primary);
		padding: 0 0.5em;
		border-radius: 1em;
		color: var(--surface-variant);
	}

	.replies {
		margin-left: 0;
	}
</style>
