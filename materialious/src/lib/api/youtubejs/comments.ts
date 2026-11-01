import { extractNumber } from '$lib/numbers';
import { YT, YTNodes, type Actions } from 'youtubei.js';
import { getInnertube } from '.';
import type { Comment, Comments, CommentsOptions, Thumbnail } from '../model';

function invidiousCommentContentSchema(result: YTNodes.CommentView): Comment | undefined {
	if (!result.author) return;

	return {
		author: result.author.name ?? '',
		authorId: result.author.id ?? '',
		authorUrl: `/channel/${result.author.id}`,
		authorThumbnails: result.author.thumbnails as Thumbnail[],
		isEdited: false,
		isPinned: result.is_pinned === true,
		content: result.content?.text ?? '',
		contentHtml: result.content?.toHTML() ?? '',
		published: 0,
		publishedText: result.published_time ?? '',
		likeCount: countOf(result.like_count ?? '0'),
		authorIsChannelOwner: result.author_is_channel_owner === true,
		creatorHeart: {
			creatorName: result.heart_active_tooltip?.split('@')[1] ?? '',
			creatorThumbnail: result.creator_thumbnail_url ?? ''
		},
		replies: {
			replyCount: countOf(result.reply_count ?? '0'),
			continuation: ''
		}
	};
}

/**
 * A count as YouTube writes it - "961", "1.2K", "3M" - as a number. Stripping
 * everything but the digits turned "1.2K" into 12.
 */
function countOf(text: string): number {
	const match = text.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
	if (!match) return 0;

	const scale = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase() as 'K' | 'M' | 'B'] ?? 1;
	return Math.round(Number(match[1]) * scale) || 0;
}

/** A batch of replies, either the first a thread fetched or a later one. */
interface ReplyPage {
	replies?: YTNodes.CommentThread[];
	has_continuation: boolean;
	getContinuation(): Promise<ReplyPage>;
}

/**
 * One batch of replies, and the way to the next. YouTube sends three at
 * first and ten at a time after that, so a thread of hundreds needs paging:
 * only the first batch was ever shown.
 */
function replyPage(videoId: string, page: ReplyPage): Comments {
	const replies: Comments = {
		videoId,
		commentCount: 0,
		comments: (page.replies ?? [])
			.map((thread) => (thread.comment ? replyContent(thread.comment) : undefined))
			.filter((comment): comment is Comment => !!comment),
		continuation: page.has_continuation ? 'logicalPlaceholder' : undefined
	};

	if (page.has_continuation) {
		replies.getContinuation = async () => replyPage(videoId, await page.getContinuation());
	}

	return replies;
}

/**
 * A thread's first batch of replies, fetched here rather than by youtubei.js:
 * it looks for the way to them only among a thread's sub-threads, and the
 * comments the browser is sent carry it in the replies' contents instead, so
 * every thread failed with "Replies continuation item not found".
 */
async function fetchReplies(thread: YTNodes.CommentThread, actions: Actions): Promise<ReplyPage> {
	const data = thread.comment_replies_data;
	const item =
		data?.sub_threads.firstOfType(YTNodes.ContinuationItem) ??
		data?.contents.firstOfType(YTNodes.ContinuationItem);

	const endpoint = item?.button?.endpoint ?? item?.endpoint;
	if (!endpoint) return thread.getReplies();

	return repliesFrom(endpoint, actions);
}

/** One batch of replies from where a "show replies" or "more" points. */
async function repliesFrom(
	endpoint: YTNodes.NavigationEndpoint,
	actions: Actions
): Promise<ReplyPage> {
	const response = await endpoint.call(actions, { parse: true });
	const items =
		response.on_response_received_endpoints?.firstOfType(YTNodes.AppendContinuationItemsAction)
			?.contents ?? [];

	const more = items.find((item) => item.is(YTNodes.ContinuationItem)) as
		| YTNodes.ContinuationItem
		| undefined;
	const next = more?.button?.endpoint ?? more?.endpoint;

	return {
		// Replies come as threads of their own, or - in the layout that broke
		// youtubei.js - as bare comments; either is a reply.
		replies: items
			.map((item) =>
				item.is(YTNodes.CommentThread)
					? item
					: item.is(YTNodes.CommentView)
						? ({ comment: item } as YTNodes.CommentThread)
						: undefined
			)
			.filter((thread): thread is YTNodes.CommentThread => !!thread),
		has_continuation: !!next,
		getContinuation: async () => {
			if (!next) throw new Error('No more replies');
			return repliesFrom(next, actions);
		}
	};
}

/** A reply has none of its own to show. */
function replyContent(view: YTNodes.CommentView): Comment | undefined {
	const reply = invidiousCommentContentSchema(view);
	if (reply) reply.replies = { replyCount: 0, continuation: '' };
	return reply;
}

function invidiousCommentSchema(innerResults: YT.Comments, videoId: string) {
	const comment: Comment[] = [];

	innerResults.contents.forEach(async (result) => {
		if (result.comment) {
			const invidiousResult = invidiousCommentContentSchema(result.comment);
			if (invidiousResult) {
				if (result.has_replies) {
					invidiousResult.getReplies = async () =>
						replyPage(videoId, await fetchReplies(result, (await getInnertube()).actions));
				}

				comment.push(invidiousResult);
			}
		}
	});

	return comment;
}

async function fetchCommentsWithContinuation(
	videoId: string,
	innerResults: YT.Comments,
	options: CommentsOptions
): Promise<Comments> {
	const comments: Comments = {
		videoId: videoId,
		comments: invidiousCommentSchema(innerResults, videoId),
		commentCount: extractNumber(innerResults.header?.comments_count.text ?? '0'),
		continuation: innerResults.has_continuation ? 'logicalPlaceholder' : undefined
	};

	if (comments.continuation) {
		comments.getContinuation = async () => {
			const continuation = await innerResults.getContinuation();
			return fetchCommentsWithContinuation(videoId, continuation, options);
		};
	}

	return comments;
}

export async function getCommentsYTjs(
	videoId: string,
	options: CommentsOptions
): Promise<Comments> {
	const innertube = await getInnertube();

	const innerResults = await innertube.getComments(
		videoId,
		options.sort_by === 'top' ? 'TOP_COMMENTS' : 'NEWEST_FIRST'
	);

	return fetchCommentsWithContinuation(videoId, innerResults, options);
}
