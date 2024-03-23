import { getSearch } from '$lib/Api/index.js';

export async function load({ params }) {
  return {
    search: await getSearch(params.slug, { type: "video" }),
    slug: params.slug
  };
}