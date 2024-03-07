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

export interface Video {
  type: "video";
  title: string;
  videoId: string;
  author: string;
  authorId: string;
  authorUrl: string;
  authorVerified: boolean;
  videoThumbnails: Thumbnail[];
  description: string;
  descriptionHtml: string;
  viewCount: number;
  viewCountText: string;
  lengthSeconds: number;
  published: number;
  publishedText: string;
  premiereTimestamp: number;
  liveNow: boolean;
  premium: boolean;
  isUpcoming: boolean;
}