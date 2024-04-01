import { getPlaylist } from '$lib/Api/index.js';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  let playlist;

  try {
    playlist = await getPlaylist(params.slug);
  } catch (errorMessage: any) {
    error(500, errorMessage);
  }
  return {
    playlist: playlist
  };
}