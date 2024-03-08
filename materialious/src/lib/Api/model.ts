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
  authorId: string;
  lengthSeconds: number;
  viewCountText: string;
}

export interface Video extends VideoBase {
  type: "video";
  title: string;
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

export interface AuthorThumbnails {
  url: string;
  width: string;
  height: string;
}

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
  formatStreams: FormatStreams[];
  recommendedVideos: VideoBase[];
  authorThumbnails: AuthorThumbnails[];
  captions: Captions[];
}

export interface ReturnYTDislikes {
  id: string;
  dateCreated: string;
  likes: number;
  dislikes: number;
  rating: number;
  viewCount: number;
  deleted: boolean;
}

export interface Comment {
  author: string;
  authorThumbnails: AuthorThumbnails[];
  authorID: string;
  authorUrl: string;
  isEdited: boolean;
  isPinned: boolean;
  content: string;
  contentHtml: string;
  published: number;
  publishedText: string;
  likeCount: number;
  authorIsChannelOwner: boolean;
  creatorHeart: {
    creatorThumbnail: string;
    creatorName: string;
  };
  replies: {
    replyCount: number;
    continuation: string;
  };
}

export interface Comments {
  commentCount: number;
  videoId: string;
  continuation?: string;
  comments: Comment[];
}