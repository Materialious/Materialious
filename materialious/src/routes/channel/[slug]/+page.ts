import { getChannel } from '$lib/Api/index.js';

export async function load({ params }) {
  return {
    channel: await getChannel(params.slug)
  };
}