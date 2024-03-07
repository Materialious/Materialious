import { getVideo } from '$lib/Api/index.js';

export async function load({ params }) {
  return { video: await getVideo(params.slug) };
};
