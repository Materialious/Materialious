# Materialious-full

This guide is for the docker image `wardpearce/materialious-full`. It is **not** for `wardpearce/materialious`, the front-end only image documented in [DOCKER](./DOCKER.md).

## Overview

`materialious-full` ships Materialious with a bundled backend and account system:

- Built-in users, subscriptions, watch history, and settings stored in a database.
- A built-in CORS proxy, so no reverse-proxy CORS configuration is needed for Invidious.
- Server-side fetches for video data, dislikes, SponsorBlock, and DeArrow.

## Prerequisites

- Docker and Docker Compose installed on your host.
- Recommended: a reverse proxy with HTTPS in front of this container. HTTPS is required only for the proof-of-work captcha (see below); without it, set `PUBLIC_CAPTCHA_DISABLED: "true"`.
- The URL of your Invidious instance (only if you use Invidious).

## TOC

* [Step 1: Deploy the container](#step-1-deploy-the-container)
  * [Invidious configuration](#invidious-configuration-if-using-invidious)
  * [Proof-of-work Captcha](#proof-of-work-captcha)
  * [Docker Compose](#docker-compose)
* [Step 2 (Optional, but recommended): Self-host RYD-Proxy](#step-2-optional-but-recommended-self-host-ryd-proxy)
* [Troubleshooting](#troubleshooting)

## Step 1: Deploy the container

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

### Docker Compose

```yaml
services:
  materialious:
    image: wardpearce/materialious-full:latest
    restart: unless-stopped
    ports:
      - 3000:3000
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--spider", "http://localhost:3000/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    environment:
      # Secret key used to sign authentication cookies (minimum 16 characters).
      # Required only when PUBLIC_INTERNAL_AUTH is "true" (the default).
      # Use a long, random string. Generate one with:
      #   openssl rand -hex 32
      COOKIE_SECRET: ""

      # Database connection URI for storing users, subscriptions, history, and settings.
      # Required only when PUBLIC_INTERNAL_AUTH is "true" (the default).
      # Supported: postgresql, mysql2, mariadb, sqlite
      # Format guide: https://docs.preset.io/docs/uri-connection-strings
      # SQLite example: "sqlite:///materialious-data/materialious.db"
      DATABASE_CONNECTION_URI: "sqlite:///materialious-data/materialious.db"

      # YouTube player ID used by youtubei.js for video playback.
      # Can be left blank to use the default, but setting an older player ID
      # may fix video playback issues with local video processing.
      # Find player IDs at: https://youtube-player-ids.nadeko.net
      PUBLIC_PLAYER_ID: ""

      # Enable Materialious built-in account system for user authentication.
      # When "false", the instance runs without any authentication system.
      PUBLIC_INTERNAL_AUTH: "true"

      # Require authentication to access this instance's proxy.
      # Should be "true" for public instances to prevent unauthorized proxy usage.
      # Only set to "false" for personal/private instances.
      PUBLIC_REQUIRE_AUTH: "true"

      # Allow new user registrations. Set to "true" for public instances.
      # When "false", only existing users can log in (no new accounts).
      PUBLIC_REGISTRATION_ALLOWED: "false"

      # Comma-separated list of usernames that have admin privileges.
      # Admins can manage users and instance settings.
      # e.g. "user1,user2"
      PUBLIC_ADMIN_USERNAMES: ""
      
      # Disable proof-of-work captcha on registration/login.
      # Captcha only works with HTTPS. If using HTTP, set this to "true".
      PUBLIC_CAPTCHA_DISABLED: "false"

      # Disable rate limiting on sensitive endpoints (login, registration).
      # Not recommended for public instances. "false" enables rate limiting.
      # PUBLIC_RATE_LIMIT_DISABLED is a deprecated alias that also works.
      RATE_LIMIT_DISABLED: "false"

      # Number of days to keep watch history before automatic deletion.
      # Set to "-1" to keep history forever. Defaults to 365 days.
      HISTORY_CULLING: "365"
      
      # Comma-separated list of additional domains allowed through the proxy.
      # Use base domains only (e.g. "youtube.com,google.com").
      # Do NOT include protocol or paths (not "https://youtube.com").
      WHITELIST_BASE_DOMAIN: ""
  
      # Path to a CA certificate file to trust (useful for self-signed certs).
      # Leave blank to use system default certificates.
      PROXY_TRUST_CA: ""

      # Disable the built-in CORS proxy. When "true", the browser must
      # respect CORS headers directly. Most users should leave as "false".
      PUBLIC_PROXY_DISABLED: "false"

      # Allow proxying ANY domain (DANGEROUS - use with caution).
      # Requires ALL of the following to take effect:
      #   - PUBLIC_REGISTRATION_ALLOWED: "false"
      #   - PUBLIC_REQUIRE_AUTH: "true"
      #   - PUBLIC_INTERNAL_AUTH: "true"
      #   - You must be logged in
      PUBLIC_DANGEROUS_ALLOW_ANY_PROXY: "false"

      # Default Invidious instance for fetching video data.
      # Leave blank to use the public Invidious API.
      # This domain is automatically whitelisted in the proxy.
      PUBLIC_DEFAULT_INVIDIOUS_INSTANCE: ""

      # Return YouTube Dislike API instance URL.
      # Leave blank to disable dislike counts completely.
      # This domain is automatically whitelisted in the proxy.
      # Default: "https://returnyoutubedislikeapi.com"
      PUBLIC_DEFAULT_RETURNYTDISLIKES_INSTANCE: "https://returnyoutubedislikeapi.com"

      # SponsorBlock API instance URL.
      # Leave blank to disable SponsorBlock completely.
      # This domain is automatically whitelisted in the proxy.
      # Default: "https://sponsor.ajay.app"
      PUBLIC_DEFAULT_SPONSERBLOCK_INSTANCE: "https://sponsor.ajay.app"

      # DeArrow API instance URL for replacing sensational titles.
      # Leave blank to disable DeArrow completely.
      # This domain is automatically whitelisted in the proxy.
      # Default: "https://sponsor.ajay.app"
      PUBLIC_DEFAULT_DEARROW_INSTANCE: "https://sponsor.ajay.app"

      # DeArrow thumbnail replacement instance URL.
      # This domain is automatically whitelisted in the proxy.
      # Default: "https://dearrow-thumb.ajay.app"
      PUBLIC_DEFAULT_DEARROW_THUMBNAIL_INSTANCE: "https://dearrow-thumb.ajay.app"

      # JSON string of default Materialious settings for new users.
      # Only applies on first visit; won't override existing browser settings.
      # Use Settings → Export/Import to generate valid JSON.
      # See SETTINGS.md for all available options.
      PUBLIC_DEFAULT_SETTINGS: '{"themeColor": "#2596be","region": "US"}'

    volumes:
      - materialious-data:/materialious-data

volumes:
  materialious-data: 
```

### Overwriting Materialious defaults
Materialious lets you customize the default settings by overriding them with `PUBLIC_DEFAULT_SETTINGS`. To configure this easily, go to **Settings** → **Export/Import** and click "Export to clipboard" under the "Settings" header. For more details, check the [SETTINGS](./SETTINGS.md) page.

**Please note:** These overwrites only apply on 1st load & won't replace existing configuration stored in browser local storage.

## Step 2 (Optional, but recommended): Self-host RYD-Proxy
The snippets below are **fragments**: add them under `services:` in the same compose file you created in [Step 1](#step-1-deploy-the-container).

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

Modify/add `PUBLIC_DEFAULT_RETURNYTDISLIKES_INSTANCE` for Materialious to be the reverse proxied URL of RYD-Proxy (e.g. `https://ryd-proxy.example.com`), then restart the container:

```bash
docker compose up -d
```

## Troubleshooting

### "COOKIE_SECRET must be at least 16 characters long"
The container refuses to start. Generate a long, random secret and set it in your compose file configuration:

```bash
openssl rand -hex 32
```

### Captcha fails / registration or login is blocked
The proof-of-work captcha only works over HTTPS. Either put this container behind an HTTPS reverse proxy, or if you are running plain HTTP set `PUBLIC_CAPTCHA_DISABLED: "true"`.

### Requests to Invidious/RYD/DeArrow are blocked at the proxy level
The proxy only allows known base domains, plus whatever you configure:

- Every `PUBLIC_DEFAULT_*_INSTANCE` URL is automatically whitelisted for you.
- Add any other service through `WHITELIST_BASE_DOMAIN`, a comma-separated list of **base domains only**.
  - Correct: `"youtube.com,google.com"`
  - Incorrect: `"https://youtube.com,https://videos.google.com"`
- After changing any `PUBLIC_*` or `WHITELIST_BASE_DOMAIN` value, restart the container:

```bash
docker compose up -d
```

### Changing a `PUBLIC_*` environment variable does nothing
In `materialious-full` the `PUBLIC_*` variables are read at runtime, not at build time. Restart the container after editing them as above.
