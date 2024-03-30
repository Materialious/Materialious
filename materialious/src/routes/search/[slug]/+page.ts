import { getSearch } from '$lib/Api/index';

export async function load({ params, url }) {
  let type: "playlist" | "all" | "video" | "channel";

  const queryFlag = url.searchParams.get('type');
  if (queryFlag && ['playlist', 'video', 'channel', 'all'].includes(queryFlag)) {
    type = queryFlag;
  } else {
    type = 'all';
  }
  return {
    search: await getSearch(params.slug, { type: type }),
    slug: params.slug,
    searchType: type
  };
}
