import { getFeed } from '$lib/Api/index.js';

export async function load({ params }) {
  return {
    feed: await getFeed(100, 1)
  };
}