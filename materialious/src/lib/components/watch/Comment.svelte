<script lang="ts">
	import { resolve } from '$app/paths';
	import { getComments } from '$lib/api';
	import { type Comment, type Comments } from '$lib/api/model';
	import { getBestThumbnail, proxyGoogleImage } from '$lib/images';
	import { numberWithCommas } from '$lib/numbers';
	import CommentSelf from './Comment.svelte';
	import { truncate } from '$lib/misc';
	import { _ } from '$lib/i18n';
	import { extractActualLink } from '$lib/description';
	import { Avatar } from 'melt/builders';
	import { mergeAttrs } from 'melt';

	interface Props {
		comment: Comment;
		videoId: string;
		isSubComp?: boolean;
	}

	let { comment, videoId, isSubComp = false }: Props = $props();

	let replies: Comments | undefined = $state(undefined);

	const replyText: string = comment.replies?.replyCount > 1 ? $_('replies') : $_('reply');

	async function loadReplies(continuation: string) {
		if (comment?.getReplies) {
			replies = await comment.getReplies();
		} else {
			try {
				replies = await getComments(videoId, {
					continuation: continuation,
					sort_by: 'top'
				});
			} catch {
				// Continue regardless of error
			}
		}
	}
	function parseComment(html: string): string {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		const links = doc.querySelectorAll('a');

		links.forEach((link) => {
			const href = link.getAttribute('href');
			if (!href) return;

			const realHref = extractActualLink(href);
			const dataOnClick = link.getAttribute('data-onclick');

			link.classList.add('link');

			if (dataOnClick === 'jump_to_time' || (realHref && realHref.includes('t='))) {
				const match = realHref?.match(/t=(\d+)/);
				const timestamp = match ? match[1] : '';

				const newHref = resolve(`/watch/[videoId]?time=${timestamp}`, { videoId });

				link.setAttribute('href', newHref);
				link.removeAttribute('data-onclick');
				link.setAttribute('data-sveltekit-preload-data', 'off');
			} else {
				link.setAttribute('href', realHref);
				link.setAttribute('target', '_blank');
				link.setAttribute('referrerpolicy', 'no-referrer');
			}
		});

		return doc.documentElement.outerHTML;
	}

	const avatar = new Avatar({ src: proxyGoogleImage(getBestThumbnail(comment.authorThumbnails)) });
</script>

<article class="comment" class:border={!isSubComp}>
	<div class="comment-header">
		<img {...avatar.image} loading="lazy" class="circle small" alt="comment profile" />
		<button
			class="secondary-container"
			{...mergeAttrs(avatar.fallback, {
				style: 'text-transform: uppercase;border-radius: 2.5rem !important;'
			})}>{comment.author[1]}</button
		>
		<div class="comment-info">
			<a href={resolve(`/channel/[authorId]`, { authorId: comment.authorId })} class="author">
				<span class="bold" class:channel-owner={comment.authorIsChannelOwner}>
					{truncate(comment.author, 12)}
				</span>
				<span class="secondary-text">{comment.publishedText}</span>
			</a>
			<p class="no-margin">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html parseComment(comment.contentHtml)}
				<!-- Comment comes directly from YT so is already sanitized -->
			</p>
			<div class="comment-actions">
				<p class="no-margin no-padding"><i>thumb_up</i> {numberWithCommas(comment.likeCount)}</p>
				{#if comment.replies && !replies}
					<button
						onclick={async () => loadReplies(comment.replies.continuation)}
						class="transparent replies"
					>
						<i>expand_more</i>
						<span>{comment.replies.replyCount} {replyText}</span>
					</button>
				{:else if replies}
					<button onclick={() => (replies = undefined)} class="transparent replies">
						<i>expand_less</i>
						<span>Hide {replyText}</span>
					</button>
				{/if}
			</div>
		</div>
	</div>

	{#if replies}
		{#each replies.comments as reply (reply)}
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
