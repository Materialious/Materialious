import type { Image, Thumbnail, VideoBase, VideoPlay } from '$lib/Api/model';
import { numberWithCommas } from '$lib/misc';

export async function patchYoutubeJs(videoId: string): Promise<VideoPlay> {
  const innertube = (await import('youtubei.js')).Innertube;

  const tokens = await (window as any).electron.generatePoToken();

  const youtube = await innertube.create({
    visitor_data: tokens.visitorData,
    po_token: tokens.poToken
  });

  const video = await youtube.getInfo(videoId);

  if (!video.primary_info || !video.secondary_info) {
    throw new Error('Unable to pull video info from youtube.js');
  }

  let manifest = await video.toDash();

  // Hack to fix video not displaying.
  // Thanks to absidue & Andrews54757
  manifest = manifest.replaceAll('<EssentialProperty', '<SupplementalProperty');
  const dashUri = URL.createObjectURL(new Blob([manifest], { type: 'application/dash+xml;charset=utf8' }));

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
    title: video.primary_info.title.toString(),
    viewCount: Number(video.primary_info.view_count.toString().replace(/\D/g, '')),
    viewCountText: video.primary_info.view_count.toString(),
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
    publishedText: video.primary_info.published.toString(),
    premiereTimestamp: 0,
    liveNow: false,
    premium: false,
    isUpcoming: false,
    videoId: videoId,
    videoThumbnails: video.basic_info.thumbnail as Thumbnail[],
    author: video.basic_info.author || 'Unknown',
    lengthSeconds: video.basic_info.duration || 0,
    subCountText: '',
    keywords: video.basic_info.keywords || [],
    allowedRegions: []
  };
}