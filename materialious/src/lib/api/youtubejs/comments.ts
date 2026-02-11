import { extractNumber } from '$lib/numbers';
import { YTNodes } from 'youtubei.js';
import { getInnertube } from '.';
import type { Comment, Comments, CommentsOptions, Thumbnail } from '../model';

function invidiousSchema(result: YTNodes.CommentView): Comment | undefined {
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
		published: 0, // Placeholder, adjust accordingly
		publishedText: result.published_time ?? '',
		likeCount: extractNumber(result.like_count ?? '0'),
		authorIsChannelOwner: result.author_is_channel_owner === true,
		creatorHeart: {
			creatorName: result.heart_active_tooltip?.split('@')[1] ?? '',
			creatorThumbnail: result.creator_thumbnail_url ?? ''
		},
		replies: {
			replyCount: extractNumber(result.reply_count ?? '0'),
			continuation: ''
		}
	};
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

	const comments: Comment[] = [];

	innerResults.contents.forEach(async (result) => {
		if (result.comment) {
			const invidiousResult = invidiousSchema(result.comment);
			if (invidiousResult) {
				if (result.has_replies)
					invidiousResult.getReplies = async (): Promise<Comments> => {
						const replies = await result.getReplies();
						if (!replies.replies) return { videoId: '', comments: [], commentCount: 0 };

						const comments: Comment[] = replies.replies
							.map((reply) => invidiousSchema(reply))
							.filter((comment): comment is Comment => !!comment);

						return {
							videoId: '',
							comments: comments,
							commentCount: 0
						};
					};

				comments.push(invidiousResult);
			}
		}
	});

	return {
		videoId: videoId,
		comments: comments,
		commentCount: extractNumber(innerResults.header?.comments_count.text ?? '0')
	};
}
