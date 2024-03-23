import { amSubscribed, getComments, getDislikes, getVideo, postHistory } from '$lib/Api/index.js';
import { phaseDescription } from '$lib/misc';
import { get } from 'svelte/store';
import { auth, playerProxyVideos, returnYtDislikes } from '../../../store';

export async function load({ params }) {
  const video = await getVideo(params.slug, get(playerProxyVideos));
  if (get(auth)) {
    postHistory(video.videoId);
  }

  let comments;
  try {
    comments = video.liveNow ? null : await getComments(params.slug, { sort_by: "top", source: "youtube" });
  } catch {
    comments = null;
  }

  let returnYTDislikes;
  try {
    returnYTDislikes = get(returnYtDislikes) ? await getDislikes(params.slug) : null;
  } catch {
    returnYTDislikes = null;
  }

  return {
    video: video,
    returnYTDislikes: returnYTDislikes,
    comments: comments,
    subscribed: await amSubscribed(video.authorId),
    content: phaseDescription(video.description)
  };
};
