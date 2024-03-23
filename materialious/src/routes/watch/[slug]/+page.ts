import { amSubscribed, getComments, getDislikes, getVideo, postHistory } from '$lib/Api/index.js';
import { phaseDescription } from '$lib/misc';
import { get } from 'svelte/store';
import { auth, playerProxyVideos, returnYtDislikes } from '../../../store';

export async function load({ params }) {
  const video = await getVideo(params.slug, get(playerProxyVideos));
  if (get(auth)) {
    postHistory(video.videoId);
  }

  return {
    video: video,
    returnYTDislikes: get(returnYtDislikes) ? await getDislikes(params.slug) : null,
    comments: video.liveNow ? null : await getComments(params.slug, { sort_by: "top", source: "youtube" }),
    subscribed: await amSubscribed(video.authorId),
    content: phaseDescription(video.description)
  };
};
