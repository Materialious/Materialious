import { getPlaylist } from '$lib/Api/index.js';

export async function load({ params }) {
  return {
    playlist: await getPlaylist(params.slug)
  };
}