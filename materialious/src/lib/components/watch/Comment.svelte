<script lang="ts">
	import { resolve } from '$app/paths';
	import { getComments } from '#lib/api/index';
	import { invidiousInstanceStore } from '#lib/store';
	import { type Comment, type Comments } from '#lib/api/model';
	import { getBestThumbnail, imageHandleCors, proxyGoogleImage } from '#lib/images';
	import { numberWithCommas } from '#lib/numbers';
	import CommentSelf from './Comment.svelte';
	import { truncate } from '#lib/utils';
	import { _ } from '#lib/i18n/index';
	import { extractActualLink, getTimestampFromUrl } from '#lib/description';
	import { Avatar } from 'melt/builders';
	import { mergeAttrs } from 'melt';

	interface Props {
		comment: Comment;
		videoId: string;
		isSubComp?: boolean;
		onTimestampClick?: (time: number) => void;
	}

	let { comment, videoId, isSubComp = false, onTimestampClick }: Props = $props();

	let replies: Comments | undefined = $state(undefined);

	const replyText = $derived((comment.replies?.replyCount ?? 0) > 1 ? $_('replies') : $_('reply'));

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

				const newHref = `${resolve('/(app)/watch/[slug]', { slug: videoId })}?time=${timestamp}`;

				link.setAttribute('href', newHref);
				link.removeAttribute('data-onclick');
				link.setAttribute('data-sveltekit-preload-data', 'false');
			} else {
				link.setAttribute('href', realHref);
				link.setAttribute('target', '_blank');
				link.setAttribute('referrerpolicy', 'no-referrer');
			}
		});

		// Invidious comment HTML can contain root-relative custom emoji URLs
		// (for example /ggpht/...). Resolve them against Invidious, not the
		// Materialious frontend's origin.
		if ($invidiousInstanceStore) {
			doc.querySelectorAll('img[src^="/"]').forEach((image) => {
				const src = image.getAttribute('src');
				if (src) image.setAttribute('src', new URL(src, `${$invidiousInstanceStore}/`).href);
			});
		}

		return doc.documentElement.outerHTML;
	}

	function handleCommentClick(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const anchor = target.closest('a');
		if (!anchor) return;
		const timestamp = getTimestampFromUrl(anchor.href, location.href);
		if (timestamp === null) return;

		event.preventDefault();
		onTimestampClick?.(timestamp);
	}

	let avatarSrc = $state('');
	const avatar = new Avatar({ src: () => avatarSrc });

	$effect(() => {
		const src = proxyGoogleImage(getBestThumbnail(comment.authorThumbnails));
		let active = true;
		avatarSrc = '';
		imageHandleCors(src)
			.then((url) => {
				if (active) avatarSrc = url;
			})
			.catch(() => {
				if (active) avatarSrc = '';
			});
		return () => {
			active = false;
		};
	});
</script>

	<article class="comment" class:border={!isSubComp} onclick={handleCommentClick}>
	<div class="comment-header">
		<img {...avatar.image} class="circle small" alt="comment profile" />
		<button
			class="secondary-container"
			{...mergeAttrs(avatar.fallback, {
				style: 'text-transform: uppercase;border-radius: 2.5rem !important;'
			})}>{comment.author[1]}</button
		>
		<div class="comment-info">
			<a href={resolve('/(app)/channel/[slug]', { slug: comment.authorId })} class="author">
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
						onclick={async () => loadReplies(comment.replies?.continuation ?? '')}
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
			<CommentSelf comment={reply} {videoId} isSubComp={true} {onTimestampClick} />
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
