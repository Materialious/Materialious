import { get } from "svelte/store";
import type { Image } from "./api/model";
import { instanceStore } from "./store";

export function getBestThumbnail(
  images: Image[] | null,
  maxWidthDimension: number = 480,
  maxHeightDimension = 360
): string {
  if (images && images.length > 0) {
    const imagesFiltered = images.filter(
      (image) => image.width < maxWidthDimension && image.height < maxHeightDimension
    );

    if (imagesFiltered.length === 0) {
      return images[0].url;
    }

    imagesFiltered.sort((a, b) => {
      return b.width * b.height - a.width * a.height;
    });

    return imagesFiltered[0].url;
  } else {
    return '';
  }
}


export function proxyGoogleImage(source: string): string {
  if (source.startsWith('//')) source = `https:${source}`;

  let path: string | undefined;
  try {
    path = new URL(source).pathname;
  } catch { }

  if (typeof path === 'undefined') return '';

  return `${get(instanceStore)}/ggpht${path}`;
}