import { amSubscribed, getComments, getDislikes, getPersonalPlaylists, getVideo, postHistory } from '$lib/Api/index.js';
import type { PlaylistPage } from '$lib/Api/model';
import { phaseDescription } from '$lib/misc';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { auth, playerProxyVideos, returnYtDislikes } from '../../../store';

export async function load({ params, url }) {
  let video;
  video = await getVideo(params.slug, get(playerProxyVideos));

  if ('errorBacktrace' in video) (
    error(500, (video as { errorBacktrace: string; }).errorBacktrace)
  );

  let personalPlaylists: PlaylistPage[] | null;

  if (get(auth)) {
    postHistory(video.videoId);
    personalPlaylists = await getPersonalPlaylists();
  } else {
    personalPlaylists = null;
  }

  let comments;
  try {
    comments = video.liveNow ? null : await getComments(params.slug, { sort_by: "top", source: "youtube" });
  } catch {
    comments = null;
  }

  if (comments && 'errorBacktrace' in comments) {
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
    content: phaseDescription(video.description),
    playlistId: url.searchParams.get('playlist'),
    personalPlaylists: personalPlaylists
  };
};
