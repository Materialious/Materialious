<div align="center">  <img src="./materialious/static/logo.svg" width="200px" />
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


# Features
- [Invidious companion support.](./docs/DOCKER.md#invidious-companion-support)
- [Invidious API extended integration.](https://github.com/Materialious/api-extended)
- [YouTube.js](https://github.com/LuanRT/YouTube.js) fallback if Invidious fails loading videos for Desktop & Android.
- Support for disabling certificate validation for homelab users.
- Sync your watch progress between Invidious sessions.
- Watch sync parties.
- Sponsorblock built-in.
- Return YouTube dislikes built-in.
- DeArrow built-in (With local processing fallback).
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
|         | Dash | HLS | Local video fallback | API-Extended | Dearrow | RYD | Watch Parties |
|---------|------|-----|----------------------|--------------|---------|-----|----------------|
| Web     | ✅    | ✅   | ❌                    | ✅            | ✅       | ✅   | ✅              |
| Desktop | ✅    | ✅   | ✅                    | ✅            | ✅       | ✅   | ❌              |
| Android | ✅    | ✅   | ✅                    | ✅            | ✅       | ✅   | ❌              |

# Deploying as a website via docker
[Please read the guide here](./docs/DOCKER.md)

# Installing as a app
<!--This layout is taken from spotube's README as I really liked its layout.
I've commented out places what aren't relevant but might be in the future.-->
<table>
  <tr>
    <th>Platform</th>
    <th>Package/Installation Method</th>
  </tr>
  <tr>
    <td>Windows</td>
    <td>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-win32-x64.exe">
        <img width="220" alt="Windows Download" src="https://get.todoist.help/hc/article_attachments/4403191721234/WindowsButton.svg">
      </a>
  </tr>
  <tr>
    <td>MacOS (x64 & arm64)</td>
    <td>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-darwin-universal.dmg">
        <img width="220" alt="MacOS Download" src="https://reachify.io/wp-content/uploads/2018/09/mac-download-button-1.png">
      </a>
    </td>
  </tr>
  <tr>
    <td>Android</td>
    <td>
      <br>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/app-universal-release-signed.apk">
        <img src="https://raw.githubusercontent.com/NeoApplications/Neo-Backup/034b226cea5c1b30eb4f6a6f313e4dadcbb0ece4/badge_github.png" alt="Get it on GitHub" height="80"/>
      </a>
      </br>
      <br>
        <a href="http://apps.obtainium.imranr.dev/redirect.html?r=obtainium://add/https://github.com/Materialious/Materialious">
          <img height="60" alt="Get it on Obtainium" src="https://raw.githubusercontent.com/ImranR98/Obtainium/e3fcf6e0b5187445a76462b4042aba6b2fc15047/assets/graphics/badge_obtainium.png" />
        </a>
      </br>
      <br>
        <a href="https://f-droid.org/packages/us.materialio.app/">
          <img height="80" alt="Get it on F-Droid" src="https://fdroid.gitlab.io/artwork/badge/get-it-on.png" />
        </a>
      </br>
      <br>
      <a href="https://apt.izzysoft.de/fdroid/index/apk/us.materialio.app">
        <img height="80" alt="Get it on Izzysoft" src="https://codeberg.org/IzzyOnDroid/repo/raw/commit/9873f08e282332a231e64d9729f810f427a521e4/assets/IzzyOnDroid.png" />
      </a>
      </br>
    </td>
  </tr>
  <tr>
  <!-- <tr>
    <td>iOS</td>
    <td>
      <a href="https://github.com/">
        <img width="220" alt="Download iOS IPA" src="https://github.com/user-attachments/assets/3e50d93d-fb39-435c-be6b-337745f7c423">
      </a>
      <br/>
      <blockquote style="color:red">
        *iPA file only. Requires sideloading with <a href="https://altstore.io/">AltStore</a> or similar tools.
      </blockquote>
    </td>
  </tr> -->
  <tr>
    <td>Flatpak</td>
    <td>
      <p><code>flatpak install flathub us.materialio.Materialious</code></p>
      <a href="https://flathub.org/apps/us.materialio.Materialious">
        <img width="220" alt="Download on Flathub" src="https://flathub.org/assets/badges/flathub-badge-en.png">
      </a>
    </td>
  </tr>
  <tr>
    <td>AppImage</td>
    <td>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x86_64.AppImage">
        <img width="220" alt="Download on Flathub" src="https://user-images.githubusercontent.com/61944859/169455015-13385466-8901-48fe-ba90-b62d58b0be64.png">
      </a>
    </td>
  </tr>
  <tr>
    <td>Debian/Ubuntu</td>
    <td>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-amd64.deb">
        <img width="220" alt="Debian/Ubuntu Download" src="https://user-images.githubusercontent.com/61944859/169097994-e92aff78-fd75-4c93-b6e4-f072a4b5a7ed.png">
      </a>
      <p>Then run: <code>sudo apt install ./Materialious-linux-amd64.deb</code></p>
    </td>
  </tr>
  <!-- <tr>
    <td>Arch/Manjaro</td>
    <td>
      <p>With pamac: <code>sudo pamac install spotube-bin</code></p>
      <p>With yay: <code>yay -Sy spotube-bin</code></p>
    </td>
  </tr> -->
  <tr>
    <td>Fedora/OpenSuse</td>
    <td>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x86_64.rpm">
        <img width="220" alt="Fedora/OpenSuse Download" src="https://user-images.githubusercontent.com/61944859/223638350-5926b9da-04d6-4edd-931d-ad533e4ff058.png">
      </a>
      <p>For Fedora: <code>sudo dnf install ./Materialious-linux-x86_64.rpm</code></p>
      <p>For OpenSuse: <code>sudo zypper in ./Materialious-linux-x86_64.rpm</code></p>
    </td>
  </tr>
  <tr>
    <td>Linux (tarball)</td>
    <td>
      <a href="https://github.com/Materialious/Materialious/releases/latest/download/Materialious-linux-x64.7z">
        <img width="220" alt="Tarball Download" src="https://user-images.githubusercontent.com/61944859/169456985-e0ba1fd4-10e8-4cc0-ab94-337acc6e0295.png">
      </a>
    </td>
  </tr>
  <!-- <tr>
    <td>Macos - <a href="https://brew.sh">Homebrew</a></td>
    <td>
<pre lang="bash">
brew tap krtirtho/apps
brew install --cask spotube
</pre>
    </td>
  </tr>
  <tr>
    <td>Windows - <a href="https://chocolatey.org">Chocolatey</a></td>
    <td>
      <p><code>choco install spotube</code></p>
    </td>
  </tr>
  <tr>
    <td>Windows - <a href="https://scoop.sh">Scoop</a></td>
    <td>
      <p><code>scoop bucket add extras</code></p>
      <p><code>scoop install spotube</code></p>
    </td>
  </tr>
  <tr>
    <td>Windows - <a href="https://github.com/microsoft/winget-cli">WinGet</a></td>
    <td>
      <p><code>winget install --id KRTirtho.Spotube</code></p>
    </td>
  </tr> -->
</table>

# Translations

Help [translate Materialious via Weblate](https://toolate.othing.xyz/projects/materialious/)!

<a href="https://toolate.othing.xyz/projects/materialious/">
<img src="https://toolate.othing.xyz/widget/materialious/materialious/multi-auto.svg" alt="Translation status" />
</a>

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
- [Beer CSS](https://github.com/beercss/beercss) (Especially the [YouTube template](https://github.com/beercss/beercss/tree/main/src/youtube) what was used as the base for Materialious.)
- Every dependency in [package.json](/materialious/package.json).
- [LuanRT](https://github.com/LuanRT) for YouTube.js & SABR implementation.
- [FreeTube](https://github.com/FreeTubeApp/FreeTube) for their subtitle fix.
- [spotube](https://github.com/KRTirtho/spotube) for using their README layout for local installation.

# Developers
- [How Materialious is built](./docs/BUILDING.md)
- [How to contribute to Materialious](./docs/DEV.md)
