import { getVideo } from '$lib/api/index';
import { playerProxyVideosStore } from '$lib/store';
import type { PhasedDescription } from '$lib/timestamps';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';

export async function load({ params }) {
  let video;
  try {
    video = await getVideo(params.slug, get(playerProxyVideosStore));
  } catch (errorMessage: any) {
    error(500, errorMessage);
  }

  return {
    video: video,
    content: {
      description: '',
      timestamps: []
    } as PhasedDescription,
    playlistId: null
  };
}