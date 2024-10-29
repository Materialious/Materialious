import { getHashtag } from '$lib/api';

export async function load({ params }) {
  return {
    hashTagVideos: await getHashtag(params.slug)
  };
}