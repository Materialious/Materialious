import { getHashtag } from '$lib/api';

export async function load({ params }) {
  console.log(params.slug);
  return {
    hashTagVideos: await getHashtag(params.slug)
  };
}