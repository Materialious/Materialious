import { getFeed } from '$lib/Api/index.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const feed = await getFeed(100, 1);

  if ('errorBacktrace' in feed) (
    error(500, (feed as { errorBacktrace: string; }).errorBacktrace)
  );

  return {
    feed: await getFeed(100, 1)
  };
}