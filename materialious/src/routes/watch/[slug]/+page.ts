import { amSubscribed, getComments, getDislikes, getVideo } from '$lib/Api/index.js';

export async function load({ params }) {
  const video = await getVideo(params.slug);
  return {
    video: video,
    returnYTDislikes: await getDislikes(params.slug),
    comments: await getComments(params.slug, { sort_by: "top", source: "youtube" }),
    subscribed: await amSubscribed(video.authorId)
  };
};
