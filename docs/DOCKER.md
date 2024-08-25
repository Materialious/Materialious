# Setup
For security reasons regarding CORS, your hosted instance of Materialious must serve as the value for the `Access-Control-Allow-Origin` header on Invidious.

Invidious doesn't provide a simple way to modify CORS, so this must be done with your reverse proxy.

## Step 1: Reverse proxy
### Caddy example
```caddyfile
invidious.example.com {
	@cors_preflight {
		method OPTIONS
	}
	respond @cors_preflight 204

	header Access-Control-Allow-Credentials true
        header Access-Control-Allow-Origin "https://materialious.example.com" {
		defer
	}
        header Access-Control-Allow-Methods "GET,POST,OPTIONS,HEAD,PATCH,PUT,DELETE"
        header Access-Control-Allow-Headers "User-Agent,Authorization,Content-Type"

	reverse_proxy localhost:3000
}

materialious.example.com {
	reverse_proxy localhost:3001
}
```

### Nginx example
```nginx
server {
    listen 80;
    server_name invidious.example.com;

    location / {
        if ($request_method = OPTIONS) {
            return 204;
        }

        proxy_hide_header Access-Control-Allow-Origin;
        add_header Access-Control-Allow-Credentials true;
        add_header Access-Control-Allow-Origin "https://materialious.example.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, HEAD, PATCH, PUT, DELETE" always;
        add_header Access-Control-Allow-Headers "User-Agent, Authorization, Content-Type" always;

        proxy_pass http://localhost:3000;
    }
}

server {
    listen 80;
    server_name materialious.example.com;

    location / {
        proxy_pass http://localhost:3001;
    }
}
```
### Nginx Proxy Manager example
1. Tab: Details -  Create a new proxy host with SSL on (Let's Encrypt or your own certificate).
2. Tab: Custom locations, fill in IP and port. Click gear icon to add some security headers.   

Click image for fullsize:   
<img src="https://github.com/user-attachments/assets/bd7be837-5f08-4ceb-9fdf-f0f445228075" width=15% height=15%>



**Add:** 
```nginx
    if ($request_method = OPTIONS) {
      return 204;
    }

    proxy_hide_header Access-Control-Allow-Origin;
    add_header Access-Control-Allow-Credentials true;
    add_header Access-Control-Allow-Origin "https://materialious.example.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, HEAD, PATCH, PUT, DELETE" always;
    add_header Access-Control-Allow-Headers "User-Agent, Authorization, Content-Type" always;
```
Click **Save**.

### Traefik example
Add this middleware to your Invidious instance:
```yaml
http:
  middlewares:
    materialious:
      headers:
        accessControlAllowCredentials: true
        accessControlAllowOriginList: "https://materialious.example.com"
        accessControlAllowMethods:
          - GET
          - POST
          - OPTIONS
          - HEAD
          - PATCH
          - PUT
          - DELETE
        accessControlAllowHeaders: 
          - User-Agent
          - Authorization 
          - Content-Type
```

### Other
Please open a PR request or issue if you implement this in a different reverse proxy.

## Step 2: Invidious config
The following Invidious values must be set in your config.

- `domain:` - The reverse proxied domain of your Invidious instance.
- `https_only: true` - Must be set if you are using HTTPS.
- `external_port: 443` - Must be set if you are using HTTPS.


## Step 3: Docker
Please ensure you have followed the previous steps before doing this!

### Docker Compose

```yaml
---
services:
  materialious:
    image: wardpearce/materialious:latest
    restart: unless-stopped
    ports:
      - 3001:80
    environment:
      # No trailing backslashes!
      # URL to your proxied Invidious instance
      VITE_DEFAULT_INVIDIOUS_INSTANCE: "https://invidious.materialio.us"

      # URL TO RYD
      # Leave blank to disable completely.
      VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE: "https://returnyoutubedislikeapi.com"
  
      # URL to Sponsorblock
      # Leave blank to completely disable sponsorblock.
      VITE_DEFAULT_SPONSERBLOCK_INSTANCE: "https://sponsor.ajay.app"

      # URL to DeArrow
      VITE_DEFAULT_DEARROW_INSTANCE: "https://sponsor.ajay.app"

      # URL to DeArrow thumbnail instance
      VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE: "https://dearrow-thumb.ajay.app"

      # Look at "Overwriting Materialious defaults" for all the accepted values.
      VITE_DEFAULT_SETTINGS: '{"themeColor": "#2596be","region": "US"}'
```

### Overwriting Materialious defaults
Materialious allows you to overwrite the default values using `VITE_DEFAULT_SETTINGS`, see [SETTINGS](./SETTINGS.md) for more details.

**Please note:** These overwrites only apply on 1st load & won't replace existing configuration stored in browser local storage.

## Step 4 (Optional, but recommended): Self-host RYD-Proxy

### Step 1: Docker compose
Add the following to your docker compose file.

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

### Step 2:
Reverse proxy RYD-Proxy.

#### Caddy example
```caddy
ryd-proxy.example.com {
  header Access-Control-Allow-Origin "https://materialious.example.com" {
      defer
  }
  header Access-Control-Allow-Methods "GET,OPTIONS"
  reverse_proxy localhost:3003
}
```

#### Nginx example
```nginx
server {
    listen 80;
    server_name ryd-proxy.example.com;

    location / {
        add_header Access-Control-Allow-Origin "https://materialious.example.com" always;
        add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
        proxy_pass http://localhost:3003;
    }
}
```

#### Traefik example
Add this middleware to your RYD-Proxy instance:
```yaml
http:
  middlewares:
    ryd-proxy:
      headers:
        accessControlAllowOriginList: "https://materialious.example.com"
        accessControlAllowMethods:
          - GET
          - OPTIONS
```

### Step 3:
Modify/add `VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE` for Materialious to be the reverse proxied URL of RYD-Proxy.

## Step 5 (Optional, but recommended): Self-host Invidious API extended
Please note, Materialious configuration using the env var `VITE_DEFAULT_SYNCIOUS_INSTANCE` for Invidious API extended, this will change in the future (no-breaking.)

### Step 1: Docker compose
Add the following to your docker compose

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
VITE_DEFAULT_SYNCIOUS_INSTANCE: "https://syncious.example.com"
```

## Step 6 (Optional): Self-host PeerJS
[Read the official guide.](https://github.com/peers/peerjs-server?tab=readme-ov-file#docker)

Add these additional environment variables to Materialious.
```yaml
# Will differ depending on how you self-host peerjs.
VITE_DEFAULT_PEERJS_HOST: "peerjs.example.com"
VITE_DEFAULT_PEERJS_PATH: "/"
VITE_DEFAULT_PEERJS_PORT: 443
```
