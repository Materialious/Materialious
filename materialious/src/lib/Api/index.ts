import { get } from 'svelte/store';
import { invidiousInstance } from '../../store';
import type { Video, VideoPlay } from './model';

function buildPath(path: string): string {
  return `${get(invidiousInstance)}/api/v1/${path}`;
}

export async function getTrending(): Promise<Video[]> {
  const resp = await fetch(buildPath('trending'));
  return await resp.json();
}

export async function getVideo(videoId: string): Promise<VideoPlay> {
  const resp = await fetch(buildPath(`videos/${videoId}`));
  return await resp.json();
}