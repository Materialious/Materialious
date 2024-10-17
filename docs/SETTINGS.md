# Materialious Settings

Materialious allows you to customize various settings by overwriting the default values using the environmental variable `VITE_DEFAULT_SETTINGS`.

## TOC

- [Materialious Settings](#materialious-settings)
   * [Show warning](#Show-Warning)
   * [Theme](#theme)
      + [Dark mode / Light mode](#dark-mode-light-mode)
      + [Color](#color)
      + [Amoled](#color)
   * [Interface](#interface)
      + [Search suggestions](#search-suggestions)
      + [Preview video on hover](#preview-video-on-hover)
      + [Region](#region)
      + [Letter case for titles](#letter-case-for-titles)
      + [Auto expand comments](#auto-expand-comments)
      + [Auto expand description](#auto-expand-desc)
      + [Low bandwidth mode](#low-bandwidth-mode)
   * [Player](#player)
      + [Mini player](#mini-player)
      + [Autoplay video](#autoplay-video)
      + [Always loop video](#always-loop-video)
      + [Proxy videos](#proxy-videos)
      + [Save playback position](#save-playback-position)
      + [Listen by default](#listen-by-default)
      + [Theatre mode by default](#theatre-mode-by-default)
      + [Autoplay next by default](#autoplay-next-by-default)
      + [Dash](#dash)
   * [Sponsorblock](#sponsorblock)
      + [Sponsor](#sponsor)
      + [Unpaid/Self Promotion](#unpaidself-promotion)
         - [Self Promotion](#self-promotion)
         - [Unpaid Promotion](#unpaid-promotion)
      + [Interaction Reminder (Subscribe)](#interaction-reminder-subscribe)
      + [Intermission/Intro Animation](#intermissionintro-animation)
      + [Endcards/Credits](#endcardscredits)
      + [Preview/Recap/Hook](#previewrecaphook)
      + [Filler Tangent/Jokes](#filler-tangentjokes)
      + [Display Toast](#sponsorblockdisplaytoast)
   * [DeArrow](#dearrow)
      + [DeArrow Enabled](#dearrow-enabled)
      + [DeArrow Instance](#dearrow-instance)
      + [DeArrow Thumbnail Instance](#dearrow-thumbnail-instance)
      + [DeArrow Titles Only](#dearrow-titles-only)

## Show Warning

Show warning about Invidious being blocked.

```json
"showWarning": true
```

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

## Amoled

Use pure black theme for Materialious, Dark mode must be true.

```json
"amoledTheme": true
```

## Interface

### Search suggestions

Enables or disables search suggestions.

```json
"searchSuggestions": true
```

### Preview video on hover

Allows video previews when hovering over thumbnails.

```json
"previewVideoOnHover": true
```

### Region

Specifies the region using an ISO 3166 country code.

```json
"region": "US"
```

### Letter case for titles

Controls the letter case for titles (e.g., uppercase, lowercase).

```json
"forceCase": "uppercase"
```

### Auto expand comments

Automatically expands comments section.

```json
"autoExpandComments": true
```

### Auto expand description

Automatically expands video descriptions.

```json
"autoExpandDesc": true
```

### Low bandwidth mode

Avoids loading images.

```json
"lowBandwidthMode": true
```

## Player

### Mini player

Enables or disables the mini player feature.

```json
"playerMiniPlayer": true
```

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

### Listen by default

Enables or disables listening by default.

```json
"listenByDefault": true
```

### Theatre mode by default

Controls whether theatre mode is enabled by default.

```json
"theatreModeByDefault": false
```

### Autoplay next by default

Determines if the next video should autoplay.

```json
"autoplayNextByDefault": false
```

### Dash

Enables DASH streaming for higher resolutions.

```json
"dashEnabled": true
```

## Return YT Dislikes

Configures an open-source proxy for the Return YouTube Dislike API, with optional self-hosting.

```json
"returnYtDislikes": true
```

## Sponsorblock

Configures Sponsorblock categories for skipping unwanted video segments.

```json
"sponsorBlockCategories": "sponsor,interaction,selfpromo"
```

### Sponsor

Identifies promotional content within a video.

```json
"sponsorBlockCategories": "sponsor"
```

### Unpaid/Self Promotion

Includes categories for unpaid and self-promotion.

```json
"sponsorBlockCategories": "selfpromo"
```

### Interaction Reminder (Subscribe)

Skips explicit reminders for interactions.

```json
"sponsorBlockCategories": "interaction"
```

### Intermission/Intro Animation

Skips intermission or intro animations.

```json
"sponsorBlockCategories": "intro"
```

### Endcards/Credits

Skips endcards and credits.

```json
"sponsorBlockCategories": "outro"
```

### Preview/Recap/Hook

Skips previews, recaps, or hooks.

```json
"sponsorBlockCategories": "preview"
```

### Filler Tangent/Jokes

Skips filler, tangents, or jokes.

```json
"sponsorBlockCategories": "filler"
```

### Display Toast

Enables or disables displaying a toast notification when Sponsorblock actions occur.

```json
"sponsorBlockDisplayToast": true
```

## DeArrow

Controls the DeArrow extension for removing sensational elements from YouTube titles and thumbnails.

### DeArrow Enabled

Enables or disables the DeArrow extension.

```json
"deArrowEnabled": true
```

### DeArrow Instance

Specifies the URL for the DeArrow instance.

```json
"deArrowInstance": "https://sponsor.ajay.app"
```

### DeArrow Thumbnail Instance

Specifies the URL for the DeArrow thumbnail instance.

```json
"deArrowThumbnailInstance": "https://dearrow-thumb.ajay.app"
```

### DeArrow Titles Only

Configures DeArrow to only modify titles without changing thumbnails.

```json
"deArrowTitlesOnly": true
```
