import { getSearch } from '$lib/Api/index';
import { error } from '@sveltejs/kit';

export async function load({ params, url }) {
  let type: "playlist" | "all" | "video" | "channel";

  const queryFlag = url.searchParams.get('type');
  if (queryFlag && ['playlist', 'video', 'channel', 'all'].includes(queryFlag)) {
    type = queryFlag;
  } else {
    type = 'all';
  }

  let search;

  try {
    search = await getSearch(params.slug, { type: type });
  } catch (errorMessage: any) {
    error(500, errorMessage);
  }

  return {
    search: search,
    slug: params.slug,
    searchType: type
  };
}
