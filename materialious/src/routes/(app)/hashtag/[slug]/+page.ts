import { getHashtag } from '#lib/api/index';

export async function load({ params }) {
	return {
		hashtag: params.slug,
		hashTagVideos: await getHashtag(params.slug)
	};
}
