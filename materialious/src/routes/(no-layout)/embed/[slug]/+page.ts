import { getVideo } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';
import { get } from 'svelte/store';
import type { PhasedDescription } from '../../../../lib/misc.js';
import { playerProxyVideosStore } from '../../../../lib/store.js';

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