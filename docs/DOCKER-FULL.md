## Step 1: Docker

This Guide is for the docker image `wardpearce/materialious-full` **NOT** `wardpearce/materialious`

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
      # Not required if VITE_INTERNAL_AUTH is false
      COOKIE_SECRET: ""

      # Database connectiong URI
      # Not required if VITE_INTERNAL_AUTH is false
      # postgresql, mysql2, mariadb & sqlite supported
      # guide here for URL structure https://docs.preset.io/docs/uri-connection-strings
      DATABASE_CONNECTION_URI: "sqlite://materialious.db"

      # Use Materialious account system.
      PUBLIC_INTERNAL_AUTH: "true"

      # If Auth is required to use this instance.
      # Should be left as true, otherwise anyone can use Materialious proxy.
      PUBLIC_REQUIRE_AUTH: "true"

      # Allow anyone to register
      PUBLIC_REGISTRATION_ALLOWED: "false"
      
      # Allow any domain in proxy
      # This shouldn't be used unless you KNOW what your doing
      # requires VITE_REGISTRATION_ALLOWED to be false
      # VITE_REQUIRE_AUTH to be true
      # VITE_INTERNAL_AUTH to be true
      # to take effect.
      PUBLIC_DANGEROUS_ALLOW_ANY_PROXY: "false"

      # Optionally set a default Invidious instance
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_INVIDIOUS_INSTANCE: "https://invidious.materialio.us"

      # URL Companion instance
      # This will also whitelist this instance in the proxy.
      PUBLIC_DEFAULT_COMPANION_INSTANCE: "https://companion.materialio.us"

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
      - materialious-data:/materialious.db

volumes:
  materialious-data: 
```

### Overwriting Materialious defaults
Materialious allows you to overwrite the default values using `VITE_DEFAULT_SETTINGS`, see [SETTINGS](./SETTINGS.md) for more details.

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

Modify/add `VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE` for Materialious to be the reverse proxied URL of RYD-Proxy.

## Step 3 (Optional, but recommended): Self-host Invidious API extended
```yaml
services:
  api_extended:
    image: wardpearce/invidious_api_extended:latest
    restart: unless-stopped
    ports:
      - 3004:80
    environment:
      api_extended_postgre: '{"host": "invidious-db", "port": 5432, "database": "invidious", "user": "kemal", "password": "kemal"}'
      api_extended_allowed_origins: '["https://materialious.example.com"]'
      api_extended_debug: false

      # No trailing backslashes!
      api_extended_invidious_instance: "https://invidious.example.com"
      api_extended_production_instance: "https://syncious.example.com"
```

Add these additional environment variables to Materialious.
```yaml
VITE_DEFAULT_API_EXTENDED_INSTANCE: "https://syncious.example.com"
```

## Step 4 (Optional): Self-host PeerJS
[Read the official guide.](https://github.com/peers/peerjs-server?tab=readme-ov-file#docker)

Add these additional environment variables to Materialious.
```yaml
# Will differ depending on how you self-host peerjs.
VITE_DEFAULT_PEERJS_HOST: "peerjs.example.com"
VITE_DEFAULT_PEERJS_PATH: "/"
VITE_DEFAULT_PEERJS_PORT: 443
```
