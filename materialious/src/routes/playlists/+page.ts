import { getPersonalPlaylists } from "$lib/Api";

export async function load() {
  return {
    playlists: await getPersonalPlaylists()
  };
}