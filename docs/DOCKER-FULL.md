## Step 1: Docker

This Guide is for the docker image `wardpearce/materialious-full` **NOT** `wardpearce/materialious`

### Invidious configuration (If using Invidious)
#### Configuration
The following Invidious values must be set in your config.

- `domain:` - The reverse proxied domain of your Invidious instance.
- `https_only: true` - Must be set if you are using HTTPS.
- `external_port: 443` - Must be set if you are using HTTPS.

#### Companion support
`public_url` **MUST** be set in Invidious under **invidious_companion** for companion to work with Materialious.

e.g.
```yml
invidious_companion:
  - private_url: "http://companion:8282/companion"
    public_url:  "http://companion.example.com/companion"
```

### Proof-of-work Captcha
Will only work while using HTTPS. If in HTTP set `PUBLIC_CAPTCHA_DISABLED` to `true`

### Request to Invidious/RYD/DeArrow fails at proxy level.
Ensure the environmental variable for the relavent service is set or whitelist addtional domains using `WHITELIST_BASE_DOMAIN`, what should be comma separated and be the base domain
e.g. `"youtube.com,google.com"` NOT `"https://youtube.com,https://videos.google.com"`

### Docker Compose

```yaml
services:
  materialious:
    image: wardpearce/materialious-full:latest
    restart: unless-stopped
    ports:
      - 3000:3000
    environment:
      # Secure secret for signing cookies
      # Not required if PUBLIC_INTERNAL_AUTH is false
      COOKIE_SECRET: ""

      # Database connectiong URI
      # Not required if PUBLIC_INTERNAL_AUTH is false
      # postgresql, mysql2, mariadb & sqlite supported
      # guide here for URL structure https://docs.preset.io/docs/uri-connection-strings
      DATABASE_CONNECTION_URI: "sqlite:///materialious-data/materialious.db"

      # YouTube player id to use, can be left blank but setting to a older player id may fix 
      # video playback with local video processing.
      # https://youtube-player-ids.nadeko.net
      PUBLIC_PLAYER_ID: ""

      # Use Materialious account system.
      PUBLIC_INTERNAL_AUTH: "true"

      # If Auth is required to use this instance.
      # Should be left as true, otherwise anyone can use Materialious proxy.
      PUBLIC_REQUIRE_AUTH: "true"

      # Allow anyone to register
      PUBLIC_REGISTRATION_ALLOWED: "false"
      
      # Disable POW Captcha
      PUBLIC_CAPTCHA_DISABLED: "false"
      
      # Allows you to whitelist additional domains in proxy.
      # Should be comma separated and be the base domain
      # e.g. "youtube.com,google.com" NOT "https://youtube.com,https://videos.google.com"
      WHITELIST_BASE_DOMAIN: ""

      # Allow any domain in proxy
      # This shouldn't be used unless you KNOW what your doing
      # requires PUBLIC_REGISTRATION_ALLOWED to be false
      # PUBLIC_REQUIRE_AUTH to be true
      # PUBLIC_INTERNAL_AUTH to be true
      # to take effect.
      PUBLIC_DANGEROUS_ALLOW_ANY_PROXY: "false"

      # Optionally set a default Invidious instance
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_INVIDIOUS_INSTANCE: ""

      # URL TO RYD (Return YouTube Dislike / https://github.com/Anarios/return-youtube-dislike)
      # Leave blank to disable completely.
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_RETURNYTDISLIKES_INSTANCE: "https://returnyoutubedislikeapi.com"

      # URL to Sponsorblock
      # Leave blank to completely disable sponsorblock.
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_SPONSERBLOCK_INSTANCE: "https://sponsor.ajay.app"

      # URL to DeArrow
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_DEARROW_INSTANCE: "https://sponsor.ajay.app"

      # URL to DeArrow thumbnail instance
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_DEARROW_THUMBNAIL_INSTANCE: "https://dearrow-thumb.ajay.app"

      # Look at "Overwriting Materialious defaults" for all the accepted values.
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_SETTINGS: '{"themeColor": "#2596be","region": "US"}'

    volumes:
      - materialious-data:/materialious-data

volumes:
  materialious-data: 
```

### Overwriting Materialious defaults
Materialious lets you customize the default settings by overriding them with `PUBLIC_DEFAULT_SETTINGS`. To configure this easily, go to **Settings** → **Interface** and click "Export to JSON." For more details, check the [SETTINGS](./SETTINGS.md) page.

**Please note:** These overwrites only apply on 1st load & won't replace existing configuration stored in browser local storage.

## Step 2 (Optional, but recommended): Self-host RYD-Proxy
#### With TOR (Recommended)
```yml
tor-proxy:
  image: 1337kavin/alpine-tor:latest
  restart: unless-stopped
  environment:
    - tors=15

ryd-proxy:
  image: 1337kavin/ryd-proxy:latest
  restart: unless-stopped
  depends_on:
    - tor-proxy
  environment:
    - PROXY=socks5://tor-proxy:5566
  ports:
    - 3003:3000
```
#### Without TOR
```yml
ryd-proxy:
  image: 1337kavin/ryd-proxy:latest
  restart: unless-stopped
  ports:
    - 3003:3000
```

Modify/add `PUBLIC_DEFAULT_RETURNYTDISLIKES_INSTANCE` for Materialious to be the reverse proxied URL of RYD-Proxy.
