// Not possible to exact from typescript interfaces at runtime.

export const VideoSchema: Record<string, string> = {
	videoId: 'string',
	title: 'string',
	description: 'string',
	thumbnailUrl: 'string',
	duration: 'number',
	publishedAt: 'string',
	authorId: 'string',
	viewCount: 'number',
	viewCountText: 'string',
	likeCount: 'number',
	dislikeCount: 'number',
	commentCount: 'number',
	isLive: 'boolean',
	type: 'string'
};

export const ChannelSchema: Record<string, string> = {
	authorId: 'string',
	name: 'string',
	description: 'string',
	avatarUrl: 'string',
	bannerUrl: 'string',
	subscriberCount: 'number',
	verified: 'boolean'
};
