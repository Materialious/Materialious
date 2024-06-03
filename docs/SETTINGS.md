# Materialious Settings
Materialious allows you to overwrite the default values using `VITE_DEFAULT_SETTINGS` (code block below each setting) or click here for full [json](https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md#overwriting-materialious-defaults).

## TOC

- [Materialious Settings](#materialious-settings)
   * [Theme](#theme)
      + [Dark mode / Light mode](#dark-mode-light-mode)
      + [Color](#color)
   * [Interface](#interface)
      + [Search suggestions](#search-suggestions)
      + [Preview video on hover](#preview-video-on-hover)
      + [Region](#region)
      + [Letter case for titles](#letter-case-for-titles)
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
   * [Return YT Dislikes](#return-yt-dislikes)
   * [Syncious](#syncious)
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
   * [DeArrow](#dearrow)
   * [Bookmarklet](#bookmarklet)

## Theme

### Dark mode / Light mode

Background light (whitish) or dark (dark grey),
Set to true to enable dark mode, or false to disable it.

```
  "darkMode": true,
```

### Color

Specifies the theme color in hexadecimal format (e.g., #ff0000 for red).

```
  "themeColor": "#ff0000",
```

## Interface

### Search suggestions

Enable or disable search suggestions.

```
  "searchSuggestions": true,
```

### Preview video on hover

Preview video on hover.

```
  "previewVideoOnHover": true,
```

### Region

Any [ISO 3166](https://www.iso.org/obp/ui/#search) country code (alpha-2 code).

```
  "region": "US",
```

### Letter case for titles

```
  "forceCase": "uppercase | lowercase | sentence case | title case",
```

## Player

### Mini player

Set to true to enable mini player, or false to disable it.

```
  "playerMiniPlayer": true,
```

### Autoplay video

Set to true to enable autoplay, or false to disable it.

```
  "autoPlay": false,
```

### Always loop video

Set to true to always loop videos, or false to loop only when specified.

```
 "alwaysLoop": false,
```

### Proxy videos

Proxy videos by rotating IPs every 2 minutes to avoid rate limiting (TOR).
Optional, but recommended: [Self-host RYD-Proxy](https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md#step-4-optional-but-recommended-self-host-ryd-proxy)

```
  "proxyVideos": true,
```

### Save playback position

Set to true to save playback position, or false to reset it.

```
  "savePlaybackPosition": true,
```

### Listen by default

Set to true to enable listening by default, or false to disable it.

```
  "listenByDefault": true,
```

### Theatre mode by default

Set to true to enable theatre mode by default, or false to disable it.

```
  "theatreModeByDefault": false,
```

### Autoplay next by default

Set to true to enable autoplay, or false to disable it.

```
  "autoPlay": false,
```

### Dash

DASH is a streaming technique used by YouTube to provide resolutions higher than 720p by providing multiple files for a client to use depending on network and user preferences.

```
  "dashEnabled": true,
```

## Return YT Dislikes
An open-source, non-logging proxy for the "Return YouTube Dislike" API server.
Requests are spoofed to look like how they would appear when using the Tor Browser with the official extension. IPs are rotated every 2 minutes to avoid rate limiting.

Optional, but recommended: [Self-host RYD-Proxy](https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md#step-4-optional-but-recommended-self-host-ryd-proxy)


## Syncious

A self-hostable API extension for Invidious, made for custom clients. In short: it keeps your watch progress synced between Invidious clients / sessions.
More info and config: [Self-host Invidious API extended](https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md#step-5-optional-but-recommended-self-host-invidious-api-extended)

```
"syncious": true,
```

Environment var in Materialious [docker compose](https://github.com/Materialious/Materialious/blob/main/docs/DOCKER.md#docker-compose): 

```
VITE_DEFAULT_SYNCIOUS_INSTANCE: "https://syncious.example.com"
```

## Sponsorblock

Specifies the categories for sponsor block as comma-separated values.
More info: https://wiki.sponsor.ajay.app/w/Types

```
  "sponsorBlockCategories": "sponsor,interaction,selfpromo",
```

### Sponsor

Part of a video promoting a product or service not directly related to the creator. The creator will receive payment or compensation in the form of money or free products.
If the entire video is about the product or service, use a Full Video Label.

`sponsor`

### Unpaid/Self Promotion

#### Self Promotion

Promoting a product or service that is directly related to the creator themselves. This usually includes merchandise or promotion of monetized platforms.

#### Unpaid Promotion

The creator will not receive any payment in exchange for this promotion. This includes charity drives or free shout outs for products or other people they like.
Can be bundled into Endcards/Credits [^1].

[^1]: If it is **impossible** to cleanly cut  or overlap the segments, Interactions and Self Promotion can be included in Endcards if they also occur during the outro.

`selfpromo`

### Interaction Reminder (Subscribe)

Explicit reminders to like, subscribe or interact with them on any paid or free platform(s) (e.g. click on a video). If about something specific it should be Unpaid/Self Promotion instead.
Can be bundled with Self Promotion into Endcards/Credits [^1].

[^1]: If it is **impossible** to cleanly cut  or overlap the segments, Interactions and Self Promotion can be included in Endcards if they also occur during the outro.

`interaction`

### Intermission/Intro Animation

Segments typically found at the start of a video that include an animation, still frame or clip which are also seen in other videos by the same creator.
This can include livestream pauses with no content (looping animations or chat windows) and Copyright/ Fair Use disclaimers.
Do not include disclaimers to protect viewers, preparation or cleanup clips and as a rule of thumb, speech should usually not be included.
Do not include skits, time-lapses, slow-motion clips. (Possibly Filler Tangent/ Jokes)
Do not use this to skip past content to get to the main point of the video. (See Highlight)

`intro`

### Endcards/Credits

Typically near or at the end of the video when the credits pop up and/or endcards are shown. This should not be based solely on the YouTube annotations.
Interaction Reminder (Subscribe) or Self Promotion can be included [^1].

[^1]: If it is **impossible** to cleanly cut  or overlap the segments, Interactions and Self Promotion can be included in Endcards if they also occur during the outro.

`outro`

### Preview/Recap/Hook

Collection of clips that show what is coming up in in this video or other videos in a series where all information is repeated later in the video.
Do not include clips that only appear in the video or clips from a recapped video that is not directly linked to the current video.

`preview`

### Filler Tangent/Jokes

Filler Tangent/ Jokes is only for tangential scenes added only for filler or humor that are not required to understand the main content of the video.
This can also include: Timelapses/ B-Roll, Fake Sponsors and slow-motion clips that do not provide any context or are used as replays or B-roll.

`filler`

## DeArrow

[DeArrow](https://dearrow.ajay.app/) is an open source browser extension for crowdsourcing better titles and thumbnails on YouTube. The goal is to make titles accurate  and reduce sensationalism. No more arrows, ridiculous faces, and no more clickbait.

* Instance URL: https://sponsor.ajay.app
* Thumbnail instance URL: https://dearrow-thumb.ajay.app

```
  "deArrowEnabled": true,
```
## Bookmarklet
Copy bookmarklet with all Materilious settings within the URL. 
