import { getTrending } from '$lib/Api/index.js';

export async function load({ params }) {
  return { trending: await getTrending() };
}