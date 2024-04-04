export interface PlayerEvent {
  type: "pause" | "seek" | "change-video" | "play";
  time?: number;
  videoId?: string;
}

export interface PlayerEvents {
  events: PlayerEvent[];
  timestamp: Date;
}