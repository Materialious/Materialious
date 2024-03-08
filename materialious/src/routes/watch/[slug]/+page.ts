import { getComments, getDislikes, getVideo } from '$lib/Api/index.js';

export async function load({ params }) {
  return { video: await getVideo(params.slug), returnYTDislikes: await getDislikes(params.slug), comments: await getComments(params.slug, { sortBy: "top", source: "youtube" }) };
};
