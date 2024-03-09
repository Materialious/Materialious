import { getPopular } from '$lib/Api/index.js';

export async function load({ params }) {
  return {
    popular: await getPopular()
  };
}