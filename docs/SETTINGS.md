# Materialious Settings

Materialious allows you to customize various settings by overwriting the default values using the environmental variable `VITE_DEFAULT_SETTINGS`.

---

## TOC

* [Materialious Settings](#materialious-settings)

  * [Show Warning](#show-warning)
  * [Theme](#theme)
    * [Dark mode / Light mode](#dark-mode--light-mode)
    * [Color](#color)
    * [Amoled](#amoled)
  * [Interface](#interface)
    * [Search suggestions](#search-suggestions)
    * [Region](#region)
    * [Letter case for titles](#letter-case-for-titles)
    * [Auto expand comments](#auto-expand-comments)
    * [Auto expand description](#auto-expand-description)
    * [Auto expand chapters](#auto-expand-chapters)
    * [Low bandwidth mode](#low-bandwidth-mode)
    * [Display thumbnail avatars](#display-thumbnail-avatars)
    * [Default page](#default-page)
  * [Player](#player)
    * [Autoplay video](#autoplay-video)
    * [Always loop video](#always-loop-video)
    * [Proxy videos](#proxy-videos)
    * [Save playback position](#save-playback-position)
    * [Theatre mode by default](#theatre-mode-by-default)
    * [Autoplay next by default](#autoplay-next-by-default)
    * [Default video quality](#default-video-quality)
    * [Default playback speed](#default-playback-speed)
    * [Default language](#default-language)
    * [Captions enabled by default](#captions-enabled-by-default)
    * [Miniplayer enabled](#miniplayer-enabled)
  * [Return YouTube Dislikes](#return-youtube-dislikes)
  * [SponsorBlock](#sponsorblock)
    * [SponsorBlock enabled](#sponsorblock-enabled)
    * [SponsorBlock instance](#sponsorblock-instance)
    * [SponsorBlock categories](#sponsorblock-categories)
    * [Display toast](#display-toast)
  * [DeArrow](#dearrow)
    * [DeArrow enabled](#dearrow-enabled)
    * [DeArrow instance](#dearrow-instance)
    * [DeArrow thumbnail instance](#dearrow-thumbnail-instance)
    * [DeArrow titles only](#dearrow-titles-only)

---

## Show Warning

Show a warning about Invidious being blocked.

```json
"showWarning": true
```

---

## Theme

### Dark mode / Light mode

Controls the background mode of the application.

```json
"darkMode": true
```

### Color

Sets the theme color using a hexadecimal value.

```json
"themeColor": "#ff0000"
```

### Amoled

Use a pure black theme. Dark mode must be enabled.

```json
"amoledTheme": true
```

---

## Interface

### Search suggestions

Enables or disables search suggestions.

```json
"searchSuggestions": true
```

### Region

Specifies the region using an ISO 3166 country code.

```json
"region": "US"
```

### Letter case for titles

Controls the letter case for video titles.

Possible values:

* `uppercase`
* `lowercase`
* `sentence case`
* `title case`

```json
"forceCase": "uppercase"
```

### Auto expand comments

Automatically expands the comments section.

```json
"autoExpandComments": true
```

### Auto expand description

Automatically expands the video description.

```json
"autoExpandDesc": true
```

### Auto expand chapters

Automatically expands the chapters list.

```json
"autoExpandChapters": true
```

### Low bandwidth mode

Avoids loading images to reduce bandwidth usage.

```json
"lowBandwidthMode": true
```

### Display thumbnail avatars

Shows channel avatars on video thumbnails.

```json
"displayThumbnailAvatars": true
```

### Default page

Sets the default landing page when opening Materialious.

```json
"defaultPage": "home"
```

---

## Player

### Autoplay video

Controls whether videos autoplay.

```json
"autoPlay": false
```

### Always loop video

Determines if videos should loop automatically.

```json
"alwaysLoop": false
```

### Proxy videos

Enables video proxying to avoid rate limiting by rotating IPs.

```json
"proxyVideos": true
```

### Save playback position

Saves the playback position of videos.

```json
"savePlaybackPosition": true
```

### Theatre mode by default

Enables theatre mode automatically when starting a video.

```json
"theatreModeByDefault": true
```

### Autoplay next by default

Automatically plays the next video.

```json
"autoplayNextByDefault": true
```

### Default video quality

Sets the default video quality.

Available values include:

* `auto`
* `144`
* `240`
* `360`
* `480`
* `720`
* `1080`
* `1440`
* `2160`

```json
"defaultQuality": "1440"
```

### Default playback speed

Sets the default playback speed.

```json
"defaultPlaybackSpeed": 1
```

### Default language

Sets the preferred audio language for videos.

```json
"defaultLanguage": true
```

### Captions enabled by default

Automatically enables captions when available.

```json
"CCByDefault": true
```

### Miniplayer enabled

Enables the miniplayer feature.

```json
"miniplayerEnabled": true
```

---

## Return YouTube Dislikes

Enables the Return YouTube Dislike integration.

```json
"returnYtDislikes": true
```

### Return YouTube Dislikes instance

Specifies the API instance used for fetching dislike counts.

```json
"returnYTDislikesInstance": "https://ryd-proxy.materialio.us"
```

---

## SponsorBlock

### SponsorBlock enabled

Enables SponsorBlock integration.

```json
"sponsorBlock": false
```

### SponsorBlock instance

Specifies the SponsorBlock API instance.

```json
"sponsorBlockUrl": "https://sponsor.ajay.app"
```

<!--### SponsorBlock categories

Defines which SponsorBlock categories should be skipped.

Available values include:

* `sponsor`
* `interaction`
* `intro`
* `outro`
* `preview`
* `filler`
* `selfpromo`
* `filler`

```json
"sponsorBlockCategories": [
  "intro",
  "outro",
  "interaction"
]
```-->

### Display toast

Displays a toast notification when SponsorBlock skips a segment.

```json
"sponsorBlockDisplayToast": true
```

---

## DeArrow

Controls the DeArrow extension for removing sensational elements from YouTube titles and thumbnails.

### DeArrow enabled

Enables or disables DeArrow.

```json
"deArrowEnabled": true
```

### DeArrow instance

Specifies the DeArrow API instance.

```json
"deArrowInstance": "https://sponsor.ajay.app"
```

### DeArrow thumbnail instance

Specifies the DeArrow thumbnail instance.

```json
"deArrowThumbnailInstance": "https://dearrow-thumb.ajay.app"
```

### DeArrow titles only

Only modifies titles and leaves thumbnails unchanged.

```json
"deArrowTitlesOnly": true
```
