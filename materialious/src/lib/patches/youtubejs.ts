import type { Image, Thumbnail, VideoBase, VideoPlay } from '$lib/Api/model';
import { numberWithCommas } from '$lib/misc';
import { poTokenCacheStore } from '$lib/store';
import { Capacitor } from '@capacitor/core';
import { get } from 'svelte/store';
import { type PoTokens } from './poTokenAndroid';

export async function patchYoutubeJs(videoId: string): Promise<VideoPlay> {
  const innertube = (await import('youtubei.js')).Innertube;

  let tokens: PoTokens;

  const poTokenCache = get(poTokenCacheStore);
  if (!poTokenCache) {
    if (Capacitor.getPlatform() === 'electron') {
      tokens = await (window as any).electron.generatePoToken();
    } else if (Capacitor.getPlatform() === 'android') {
      tokens = await (await import('../../lib/patches/poTokenAndroid')).getPoToken();
    } else {
      throw new Error('This platform cant generate po tokens');
    }

    poTokenCacheStore.set(tokens);
  } else {
    tokens = poTokenCache;
  }

  const youtube = await innertube.create({
    visitor_data: tokens.visitor_data,
    po_token: tokens.po_token,
    // Custom fetch method required so capacitor http patch is used
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      return window.fetch(input, init);
    }
  });

  const video = await youtube.getInfo(videoId);

  if (!video.primary_info || !video.secondary_info) {
    throw new Error('Unable to pull video info from youtube.js');
  }

  let dashUri: string = '';

  if (!video.basic_info.is_live) {
    let manifest = await video.toDash();

    // Hack to fix video not displaying.
    // Thanks to absidue & Andrews54757
    manifest = manifest.replaceAll('<EssentialProperty', '<SupplementalProperty');
    dashUri = URL.createObjectURL(new Blob([manifest], { type: 'application/dash+xml;charset=utf8' }));
  }

  const descString = video.secondary_info.description.toString();

  let authorThumbnails: Image[];
  if (video.basic_info.channel_id) {
    authorThumbnails = (await youtube.getChannel(video.basic_info.channel_id)).metadata.avatar as Image[];
  } else {
    authorThumbnails = [];
  }

  let recommendedVideos: VideoBase[] = [];
  video.watch_next_feed?.forEach((recommended: Record<string, any>) => {
    recommendedVideos.push({
      videoThumbnails: recommended?.thumbnails as Thumbnail[] || [],
      videoId: recommended?.id || '',
      title: recommended?.title.toString() || '',
      viewCountText: numberWithCommas(Number(recommended?.view_count.toString().replace(/\D/g, '') || 0)) || '',
      lengthSeconds: recommended?.duration?.seconds || 0,
      author: recommended?.author.name || '',
      authorId: recommended?.author.id || ''
    });
  });

  return {
    type: 'video',
    title: video.primary_info.title ? video.primary_info.title.toString() : '',
    viewCount: video.primary_info.view_count ? Number(video.primary_info.view_count.toString().replace(/\D/g, '')) : 0,
    viewCountText: video.primary_info.view_count ? video.primary_info.view_count.toString() : '',
    likeCount: video.basic_info.like_count || 0,
    dislikeCount: 0,
    allowRatings: false,
    rating: 0,
    isListed: 0,
    isFamilyFriendly: video.basic_info.is_family_safe || true,
    genre: video.basic_info.category || '',
    genreUrl: '',
    dashUrl: dashUri,
    adaptiveFormats: [],
    formatStreams: [],
    recommendedVideos: recommendedVideos,
    authorThumbnails: authorThumbnails,
    captions: [],
    authorId: video.basic_info.channel_id || '',
    authorUrl: `/channel/${video.basic_info.channel_id}`,
    authorVerified: false,
    description: descString,
    descriptionHtml: video.secondary_info.description.toHTML() || descString,
    published: 0,
    publishedText: video.primary_info.published ? video.primary_info.published.toString() : '',
    premiereTimestamp: 0,
    hlsUrl: video.streaming_data?.hls_manifest_url || undefined,
    liveNow: video.basic_info.is_live || false,
    premium: false,
    isUpcoming: false,
    videoId: videoId,
    videoThumbnails: video.basic_info.thumbnail as Thumbnail[],
    author: video.basic_info.author || 'Unknown',
    lengthSeconds: video.basic_info.duration || 0,
    subCountText: '',
    keywords: video.basic_info.keywords || [],
    allowedRegions: [],
    fallbackPatch: 'youtubejs'
  };
}