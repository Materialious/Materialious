
> [!WARNING]  
> Invidious is currently being blocked by Google. Please use Materialious on [Android](https://github.com/Materialious/Materialious/releases/latest) or [Desktop](https://github.com/Materialious/Materialious/releases/latest) to get around this with local video fallback.

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
- Silence skipper (Experimental.)
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
|         | Dash | HLS | Local video fallback | API-Extended | Dearrow | RYD |
|---------|------|-----|----------------------|--------------|---------|-----|
| Web     | ✅    | ✅   | ❌                    | ✅            | ✅       | ✅   |
| Desktop | ✅    | ✅   | ✅                    | ✅            | ✅       | ✅   |
| Android | ✅    | ✅   | ✅                    | ✅            | ✅       | ✅   |

# Public instances
[Public instances are listed here](./docs/INSTANCES.md).

Open an issue to add your instance.

# Docker deployment
Deploy Materialious for your Invidious instance using Docker. Follow the steps outlined [here](./docs/DOCKER.md) for easy setup.

# Desktop (Windows/MacOS/Linux)
<div style="display: flex; gap: 5px;">
  <a href="https://github.com/Materialious/Materialious/releases/latest">
    <img src="https://raw.githubusercontent.com/NeoApplications/Neo-Backup/034b226cea5c1b30eb4f6a6f313e4dadcbb0ece4/badge_github.png" alt="Get it on GitHub" height="80"/>
  </a>
  <a href="https://snapcraft.io/materialious">
    <img height="60" alt="Get it from the Snap Store" src="https://snapcraft.io/en/dark/install.svg" />
  </a>
  <a href='https://flathub.org/apps/us.materialio.Materialious'>
    <img width='190' alt='Get it on Flathub' src='https://flathub.org/api/badge?locale=en'/>
  </a>
</div>

# Android
<div style="display: flex; gap: 5px;">
  <a href="https://github.com/Materialious/Materialious/releases/latest">
    <img src="https://raw.githubusercontent.com/NeoApplications/Neo-Backup/034b226cea5c1b30eb4f6a6f313e4dadcbb0ece4/badge_github.png" alt="Get it on GitHub" height="80"/>
  </a>
  <a href="http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/Materialious/Materialious">
    <img height="60" alt="Get it on Obtainium" src="https://raw.githubusercontent.com/ImranR98/Obtainium/e3fcf6e0b5187445a76462b4042aba6b2fc15047/assets/graphics/badge_obtainium.png" />
  </a>
  <a href="https://f-droid.org/packages/us.materialio.app/">
    <img height="80" alt="Get it on F-Droid" src="https://fdroid.gitlab.io/artwork/badge/get-it-on.png" />
  </a>
  <a href="https://apt.izzysoft.de/fdroid/index/apk/us.materialio.app">
    <img height="80" alt="Get it on Izzysoft" src="https://codeberg.org/IzzyOnDroid/repo/raw/commit/9873f08e282332a231e64d9729f810f427a521e4/assets/IzzyOnDroid.png" />
  </a>
</div>

# Previews

## Mobile
<img src="./previews/mobile-preview.png" style="height: 500px"/>

## Player
![Preview of player](./previews/player-preview.png)

## Transcript
![Preview of player transcript](./previews/transcript-preview.png)

## Settings
![Preview of settings](./previews/setting-preview.png)

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

# Developers
- [How Materialious is built](./docs/BUILDING.md)
- [How to contribute to Materialious](./docs/DEV.md)