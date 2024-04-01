import { getPersonalPlaylists } from "$lib/Api";
import { error } from "@sveltejs/kit";

export async function load() {
  let playlists;
  try {
    playlists = await getPersonalPlaylists();
  } catch (errorMessage: any) {
    error(500, errorMessage);
  }
  return {
    playlists: playlists
  };
}