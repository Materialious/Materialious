import { getPopular, getTrending } from '$lib/Api/index.js';
import { error } from '@sveltejs/kit';

export async function load() {
  let popular;

  try {
    popular = await getPopular();
  } catch (errorMessage: any) {
    if (errorMessage.toString() === 'Error: Administrator has disabled this endpoint.') {
      popular = await getTrending();
    } else {
      error(500, errorMessage);
    }
  }
  return {
    popular: popular
  };
}