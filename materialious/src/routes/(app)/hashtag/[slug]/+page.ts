import { getHashtag } from '$lib/api';

export async function load({ params }) {
  return {
    hashtag: params.slug,
    hashTagVideos: await getHashtag(params.slug)
  };
}