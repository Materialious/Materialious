export interface Image {
  url: string;
  width: number;
  height: number;
}

export interface Thumbnail {
  quality: string;
  url: string;
  width: number;
  height: number;
}


export interface VideoBase {
  videoId: string;
  title: string;
  videoThumbnails: Thumbnail[];
  author: string;
  lengthSeconds: number;
  viewCountText: string;
}

export interface Video extends VideoBase {
  type: "video";
  title: string;
  authorId: string;
  authorUrl: string;
  authorVerified: boolean;
  description: string;
  descriptionHtml: string;
  viewCount: number;
  published: number;
  publishedText: string;
  premiereTimestamp: number;
  liveNow: boolean;
  premium: boolean;
  isUpcoming: boolean;
}

export interface AdaptiveFormats {
  index: string;
  bitrate: string;
  init: string;
  url: string;
  itag: string;
  type: string;
  clen: string;
  lmt: string;
  projectionType: number;
  container: string;
  encoding: string;
  qualityLabel?: string;
  resolution?: string;
}

export interface FormatStreams {
  url: string;
  itag: string;
  type: string;
  quality: string;
  container: string;
  encoding: string;
  qualityLabel: string;
  resolution: string;
  size: string;
}

export interface Captions {
  label: string;
  languageCode: string;
  url: string;
};

export interface VideoPlay extends Video {
  keywords: string[];
  likeCount: number;
  dislikeCount: number;
  subCountText: string;
  allowRatings: boolean;
  rating: number;
  isListed: number;
  isFamilyFriendly: boolean;
  allowedRegions: string[];
  genre: string;
  genreUrl: string;
  hlsUrl?: string;
  adaptiveFormats: AdaptiveFormats[];
  formatStreams: FormatStreams;
  recommendedVideos: VideoBase[];
}