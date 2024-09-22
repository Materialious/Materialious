<div align="center">
  <img src="./materialious/static/logo.svg" width="200px" />
  <br />
  <br />
  <h1>Materialious</h1>
  <quote>
    Modern material design for Invidious.
  </quote>
</div>

&nbsp;

-------


![Preview of homepage](./previews/home-preview.png)

[Help translate Materialious!](https://fink.inlang.com/github.com/WardPearce/Materialious)

# Features
- [Invidious API extended integration!](https://github.com/Materialious/api-extended)
  - Sync your watch progress between Invidious sessions.
- Watch sync parties!
- Mini player.
- Silence skipper (Experimental.)
- ffmpeg integration for downloading videos with audio at any quality ([Configuration required](./docs/DOCKER.md#step-7-optional-enabling-downloads)).
- [YouTube.js](https://github.com/LuanRT/YouTube.js) fallback if Invidious fails loading videos for Desktop & Android.
- Preview video on hover.
- Sponsorblock built-in.
- Return YouTube dislikes built-in.
- DeArrow built-in (With local processing fallback).
- Video progress tracking & resuming.
- No ads.
- No tracking.
- Light/Dark themes.
- Custom colour themes.
- Integrates with Invidious subscriptions, watch history & more.
- Live stream support.
- Dash support.
- Chapters.
- Audio only mode.
- Playlists.
- PWA support.
- YT path redirects (So your redirect plugins should still work!)

# Support table
|         | Dash | HLS | Local video fallback | API-Extended | ffmpeg download merging | Dearrow | RYD |
|---------|------|-----|----------------------|--------------|-------------------------|---------|-----|
| Web     | ✅    | ✅   | ❌                    | ✅            | ✅                       | ✅       | ✅   |
| Desktop | ✅    | ✅   | ✅                    | ✅            | ❌                       | ✅       | ✅   |
| Android | ✅    | ✅   | ✅                    | ✅            | ❌                       | ✅       | ✅   |

# Public instances
[Public instances are listed here](./docs/INSTANCES.md).

Open an issue to add your instance.

# Docker deployment
Deploy Materialious for your Invidious instance using Docker. Follow the steps outlined [here](./docs/DOCKER.md) for easy setup.

# Desktop (Windows/MacOS/Linux)
The latest release can be downloaded [here](https://github.com/Materialious/Materialious/releases/latest).

# Android
Due to Google's policies on custom YouTube frontends, Materialious isn't available on Google play. The best way to install is via the [release page](https://github.com/Materialious/Materialious/releases/latest). It is recommended to use [Obtainium](https://github.com/ImranR98/Obtainium), to keep Materialious up to date.

# Previews

## Mobile
<img src="./previews/mobile-preview.png" style="height: 500px"/>

## Player
![Preview of player](./previews/player-preview.png)

## Transcript
![Preview of player transcript](./previews/transcript-preview.png)

## Settings
![Preview of settings](./previews/setting-preview.png)

## Mini player
![Preview of mini player](./previews/mini-player-desktop-preview.png)

## Channel
![Preview of channel](./previews/channel-preview.png)

## Chapters
![Preview of chapters](./previews/chapter-previews.png)

## Playlists
![Preview of playlist page](./previews/playlist-preview.png)
![Preview of playlist on video page](./previews/playlist-preview-2.png)

# Have any questions?
[Join our Matrix space](https://matrix.to/#/#ward:matrix.org)

# Special thanks to
- [SecularSteve](https://github.com/SecularSteve) for creating Materialious' logo.
- [Invidious](https://github.com/iv-org)
- [Clipious](https://github.com/lamarios/clipious) for inspiration & a good source for learning more about undocumented Invidious routes.
- [Vidstack player](https://github.com/vidstack/player)
- [Beer CSS](https://github.com/beercss/beercss) (Especially the [YouTube template](https://github.com/beercss/beercss/tree/main/src/youtube) what was used as the base for Materialious.)
- Every dependency in [package.json](/materialious/package.json).
