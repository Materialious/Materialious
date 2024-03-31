import { getTrending } from '$lib/Api/index.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const trending = await getTrending();

  if ('errorBacktrace' in trending) (
    error(500, (trending as { errorBacktrace: string; }).errorBacktrace)
  );

  return { trending: trending };
}