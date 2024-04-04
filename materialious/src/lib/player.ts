export interface PlayerEvent {
  type: "pause" | "seek" | "change-video" | "play";
  time?: number;
  videoId?: string;
}