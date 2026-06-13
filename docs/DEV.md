### Development Environment Setup

#### Prerequisites
- [Docker](https://docs.docker.com/engine/install/) & [Docker Compose](https://docs.docker.com/compose/install/)
- [Caddy](https://caddyserver.com/docs/install)
- [Node.js](https://nodejs.org/) (latest LTS recommended)

#### Invidious Deployment

Deploy Invidious locally using Docker Compose:

```yaml
services:
  invidious:
    image: quay.io/invidious/invidious:latest
    # For ARM64/AArch64 devices, uncomment the line below:
    # image: quay.io/invidious/invidious:latest-arm64
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      INVIDIOUS_CONFIG: |
        db:
          dbname: invidious
          user: kemal
          password: kemal
          host: invidious-db
          port: 5432
        check_tables: true
        https_only: true
        external_port: 443
        use_innertube_for_captions: true
        domain: invidious.localhost
        hmac_key: "some-insecure-or-secure-key-for-local-development"
    healthcheck:
      test: wget -nv --tries=1 --spider http://127.0.0.1:3000/api/v1/trending || exit 1
      interval: 30s
      timeout: 5s
      retries: 2
    logging:
      options:
        max-size: "1G"
        max-file: "4"
    depends_on:
      - invidious-db

  invidious-db:
    image: docker.io/library/postgres:14
    restart: unless-stopped
    volumes:
      - postgresdata:/var/lib/postgresql/data
    ports:
      - 5432:5432
    environment:
      POSTGRES_DB: invidious
      POSTGRES_USER: kemal
      POSTGRES_PASSWORD: kemal
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]

volumes:
  postgresdata:
```

#### Caddy Configuration

Configure Caddy to reverse proxy Invidious and Materialious with the necessary CORS and COOP/COEP headers:

```caddy
invidious.localhost {
    @cors_preflight {
        method OPTIONS
    }
    respond @cors_preflight 204

    header Access-Control-Allow-Credentials true
    header Access-Control-Allow-Origin "https://materialious.localhost" {
        defer
    }
    header Access-Control-Allow-Methods "GET,POST,OPTIONS,HEAD,PATCH,PUT,DELETE"
    header Access-Control-Allow-Headers "User-Agent,Authorization,Content-Type"
    header /ggpht/* Cross-Origin-Resource-Policy cross-origin

    reverse_proxy localhost:3000
}

materialious.localhost {
    reverse_proxy localhost:5173

    header {
        Cross-Origin-Opener-Policy "same-origin"
        Cross-Origin-Embedder-Policy "require-corp"
    }
}
```

#### Install Materialious

1. Clone the repository:

   ```bash
   git clone https://github.com/Materialious/Materialious.git
   ```

2. Navigate into the project directory:

   ```bash
   cd Materialious/materialious
   ```

3. Install dependencies (this also runs the `postinstall` script which patches Shaka Player for local playback):

   ```bash
   npm install
   ```

4. Create a `.env` file:

   ```bash
   VITE_DEFAULT_INVIDIOUS_INSTANCE="https://invidious.localhost"
   ```

   Other supported environment variables:

   | Variable | Description |
   |----------|-------------|
   | `VITE_DEFAULT_COMPANION_INSTANCE` | Default [Invidious Companion](https://github.com/iv-org/invidious-companion) instance |
   | `VITE_DEFAULT_SPONSERBLOCK_INSTANCE` | Default SponsorBlock instance |
   | `VITE_DEFAULT_DEARROW_INSTANCE` | Default DeArrow instance |
   | `VITE_DEFAULT_DEARROW_THUMBNAIL_INSTANCE` | Default DeArrow thumbnail instance |
   | `VITE_DEFAULT_RETURNYTDISLIKES_INSTANCE` | Default Return YouTube Dislike instance |
   | `VITE_DEFAULT_SETTINGS` | JSON string of default settings (see [SETTINGS](./SETTINGS.md)) |

5. Start the Vite development server:

   ```bash
   npm run dev
   ```

#### Access the Applications

- Visit `https://invidious.localhost` in your browser and click "Continue."
- Visit `https://materialious.localhost` in your browser and click "Continue."

#### Running Checks

Before submitting a pull request, run the same checks that are executed in CI:

```bash
npm run check       # Svelte type-checking
npm run eslint      # Linting
npm run build       # Production build
```

### App Type Overview

Materialious can be built and run in four different configurations, each serving a different platform:

| App Type | Adapter | Runtime | Platform |
|----------|---------|---------|----------|
| **Static web (SPA)** | `@sveltejs/adapter-static` | NGINX or any static host | Browser (all) |
| **Full web (with backend)** | `@sveltejs/adapter-node` | Node.js server | Browser (all) |
| **Desktop** | `@sveltejs/adapter-static` + Capacitor Electron | Electron | Linux, macOS, Windows |
| **Android** | `@sveltejs/adapter-static` + Capacitor Android | Android WebView | Android |

The adapter is selected at build time via the `PUBLIC_BUILD_WITH_BACKEND` environment variable in [`svelte.config.js`](../materialious/svelte.config.js):

```js
const useSsr = process.env.PUBLIC_BUILD_WITH_BACKEND === 'true';
const adapter = useSsr
    ? adapterNode({ out: 'build', precompress: true })
    : adapterStatic({ fallback: 'index.html' });
```

#### Static Web (default)

- No environment variable required.
- Builds a pure single-page application with `adapterStatic({ fallback: 'index.html' })`.
- Supports PWA via `@vite-pwa/sveltekit` (service worker, offline manifest, icons).
- Runtime configuration uses placeholder substitution via `replace_env_vars.sh` when served by NGINX (see the [Dockerfile](../materialious/Dockerfile)).
- Published as `wardpearce/materialious` on Docker Hub.

#### Full Web (with backend)

- Set `PUBLIC_BUILD_WITH_BACKEND=true` before building (export in shell or set in Dockerfile).
- Uses `adapterNode` — the SvelteKit server handles both API routes and SSR.
- Provides an account system, proxy, proof-of-work captcha, and database support (PostgreSQL, MySQL, SQLite).
- Runtime configuration is handled natively by SvelteKit's `$env/dynamic/public`.
- Published as `wardpearce/materialious-full` on Docker Hub.

#### Desktop (Electron via Capacitor)

- Built using `@capacitor-community/electron` — wraps the static SPA build in an Electron shell.
- The [`electron/`](../materialious/electron/) directory contains its own `package.json`, `capacitor.config.ts`, and [`electron-builder.config.json`](../materialious/electron/electron-builder.config.json).
- The `capacitor-nodejs` plugin is removed from the desktop build via [`patch_capacitor_plugin.py`](../materialious/electron/patch_capacitor_plugin.py) (it's Android-only).
- Supports deb, rpm, AppImage, snap (Linux), universal DMG (macOS), and NSIS installer (Windows).
- Published to GitHub Releases and Snap Store. See [BUILDING](./BUILDING.md) for details.

#### Android (Capacitor)

- Built using Capacitor Android — wraps the static SPA build in a native Android WebView.
- Capacitor configuration is in [`capacitor.config.ts`](../materialious/capacitor.config.ts):
  ```ts
  server: {
      hostname: 'www.youtube.com', // Mimics YouTube origin for API calls
      androidScheme: 'https'
  }
  ```
- Includes `capacitor-nodejs` for running a Node.js runtime directly on the device (useful for YouTube API operations that require a PO token).
- The Android-specific modules live in [`static/nodejsAndroid/`](../materialious/static/nodejsAndroid/).
- Supports custom Capacitor plugins for Android TV, color theme, music controls, screen orientation, and more (see [`src/lib/android/`](../materialious/src/lib/android/)).

#### Runtime Platform Detection

At runtime, the app detects its environment via `Capacitor.getPlatform()`:

| API | Returns | Used For |
|-----|---------|----------|
| `Capacitor.getPlatform()` | `'android'`, `'electron'`, or `'web'` | Branching on native vs. browser behavior |
| `Capacitor.isNativePlatform()` | `true` for Android or Electron | Unrestricted platform checks |

Key platform-specific behaviors:

- **Android:** Uses `@capacitor/preferences` instead of `localStorage`, `@capacitor/browser` for OAuth login, music controls via `capacitor-music-controls-plugin`, screen orientation, network status, status bar color theme, and Android TV plugins.
- **Electron:** Shows custom back/forward navigation buttons visible only on desktop, different settings UI sections.
- **Web:** Standard browser APIs (`localStorage`, `fetch`, etc.), PWA service worker, web export/import controls.
- **Fetch proxy** (`src/lib/fetchProxy.ts`): Routes requests differently per platform — on Android, images are proxied through CORS; on web, they use the configured Invidious instance directly.
- **`isUnrestrictedPlatform()`** (`src/lib/misc.ts`): Returns `true` if running on a full backend (`isOwnBackend()`) or a native platform (`Capacitor.isNativePlatform()`).
