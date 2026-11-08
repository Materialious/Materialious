import { extractNumber } from '#lib/numbers';
import { YT, YTNodes } from 'youtubei.js';
import { getInnertube } from '.';
import type { Comment, Comments, CommentsOptions, Thumbnail } from '../model';

function invidiousCommentContentSchema(
	result: YTNodes.CommentView,
	hasReplies = false
): Comment | undefined {
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
		likeCount: extractNumber(result.like_count ?? '0') || 0,
		authorIsChannelOwner: result.author_is_channel_owner === true,
		creatorHeart: {
			creatorName: result.heart_active_tooltip?.split('@')[1] ?? '',
			creatorThumbnail: result.creator_thumbnail_url ?? ''
		},
		replies:
			hasReplies && extractNumber(result.reply_count ?? '0') > 0
				? { replyCount: extractNumber(result.reply_count ?? '0'), continuation: '' }
				: undefined
	};
}

function invidiousCommentSchema(innerResults: YT.Comments, videoId: string) {
	const comment: Comment[] = [];

	innerResults.contents.forEach((result) => {
		if (result.comment) {
			const replyData = result.comment_replies_data;
			const hasReplyContinuation =
				replyData?.sub_threads.some((item) => item.is(YTNodes.ContinuationItem)) ?? false;
			const preloadedReplies =
				replyData?.contents.filter((item) => item.is(YTNodes.CommentView)) ?? [];
			const useThreadReplies = result.is_prepopulated || hasReplyContinuation;
			const canLoadReplies = useThreadReplies || preloadedReplies.length > 0;
			const invidiousResult = invidiousCommentContentSchema(result.comment, canLoadReplies);
			if (invidiousResult) {
				if (canLoadReplies)
					invidiousResult.getReplies = async (): Promise<Comments> => {
						const replyViews = useThreadReplies
							? ((await result.getReplies()).replies?.map((thread) => thread.comment) ?? [])
							: preloadedReplies;
						const comments: Comment[] = replyViews
							.map((reply) => (reply ? invidiousCommentContentSchema(reply) : undefined))
							.filter((comment): comment is Comment => !!comment);

						return {
							videoId: videoId,
							comments: comments,
							commentCount: 0
						};
					};

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
		let currentResults = innerResults;
		comments.getContinuation = async () => {
			currentResults = await currentResults.getContinuation();
			return fetchCommentsWithContinuation(videoId, currentResults, options);
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
