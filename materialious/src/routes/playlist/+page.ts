import { goto } from '$app/navigation';
import { error } from '@sveltejs/kit';

export async function load({ url }) {
  const playlistId = url.searchParams.get('list');
  if (playlistId) {
    goto(`/playlist/${playlistId}`);
  } else {
    error(404);
  }
}