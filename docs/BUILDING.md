## Building

### Pull Request Checks

Every pull request to `main` runs automated checks before merging:

| Workflow | Trigger | Checks |
|----------|---------|--------|
| [pull-web.yml](../.github/workflows/pull-web.yml) | PR to `main` | `npm install`, `npm run check` (Svelte type-checking), `npm run eslint`, `npm run build` |
| [pull-desktop.yml](../.github/workflows/pull-desktop.yml) | PR to `main` | Builds Electron app on macOS (x64) — no publish |
| [pull-android.yml](../.github/workflows/pull-android.yml) | PR to `main` | Builds Android APK/AAB (unsigned, no upload) |

### Web Deployment (via Docker)

Materialious supports web deployment through two Docker images:

#### `wardpearce/materialious` (legacy, static)

- Built by [prod-web.yml](../.github/workflows/prod-web.yml), triggered on pushes to `main`.
- Uses [Dockerfile](../materialious/Dockerfile) — a multi-stage build:
  1. **Builder stage:** `node:latest`, installs dependencies with `npm ci`, runs `npm run build`, prunes dev dependencies.
  2. **Runtime stage:** `nginx:alpine`, serves the built static files.
- Placeholder environment variables are injected into `.env` and baked into the JS bundle. At container startup, [replace_env_vars.sh](../materialious/replace_env_vars.sh) performs runtime substitution of these placeholders in the built JS/HTML.
- Published to Docker Hub as `wardpearce/materialious:latest` and `wardpearce/materialious:<version>` for `linux/amd64` and `linux/arm64`.

#### `wardpearce/materialious-full` (with backend)

- Built by [prod-full-web.yml](../.github/workflows/prod-full-web.yml), triggered on pushes to `main`.
- Uses [FullDockerfile](../materialious/FullDockerfile) — also multi-stage:
  1. **Builder stage:** `node:24-alpine`, sets `PUBLIC_BUILD_WITH_BACKEND=true` (enables SvelteKit node adapter), runs `npm ci && npm run build && npm prune --omit=dev`.
  2. **Runtime stage:** `node:24-alpine`, runs the SvelteKit node server directly (no NGINX).
- Includes an account system, proxy, PoW captcha, and database support. See [DOCKER-FULL](./DOCKER-FULL.md) for configuration.
- Published to Docker Hub as `wardpearce/materialious-full:latest` and `wardpearce/materialious-full:<version>` for `linux/amd64` and `linux/arm64`.

### Desktop Release (via GitHub Releases)

Built by [prod-desktop.yml](../.github/workflows/prod-desktop.yml), triggered on pushes to `main` (with manual `workflow_dispatch` support).

**Build matrix:**

| Runtime | OS | Format |
|---------|----|--------|
| `linux-x64` | ubuntu-latest | deb, rpm, AppImage, snap, zip, 7z |
| `win-x64` | windows-latest | NSIS installer, zip, 7z |
| `osx-x64` | macOS-latest | macOS universal binary (`.dmg`) |

**Build process:**

1. `npm ci` — install dependencies.
2. `npm run build && npm prune --omit=dev` — build the web app.
3. `npx cap sync @capacitor-community/electron` — synchronize Capacitor with the Electron platform.
4. [patch_capacitor_plugin.py](../materialious/electron/patch_capacitor_plugin.py) — removes the `capacitor-nodejs` plugin from the Electron build (not needed on desktop).
5. `npm ci` in `materialious/electron/` — install Electron-specific dependencies.
6. For Linux: `snap install snapcraft --classic` and `SNAPCRAFT_STORE_CREDENTIALS` are configured for Snap Store publishing.
7. `npm run electron:make` — builds and publishes via [electron-builder](https://www.electron.build/) using [electron-builder.config.json](../materialious/electron/electron-builder.config.json).

**electron-builder targets:**

- **Linux:** deb, rpm, AppImage, snap, zip, 7z (x64 and arm64, snap is x64 only)
- **macOS:** universal binary (x64 + arm64)
- **Windows:** NSIS installer, 7z, zip (x64 and arm64)

Publishing is configured for both GitHub Releases and the Snap Store.

### Desktop Release (via Flathub)

After the desktop build completes, [prod-flathub.yml](../.github/workflows/prod-flathub.yml) automatically:

1. Checks out the [Flathub repository](https://github.com/flathub/us.materialio.Materialious).
2. Fetches the latest release data from the Materialious GitHub releases API.
3. Downloads the `linux-x64.zip` and `linux-arm64.zip` assets and computes their SHA-256 hashes.
4. Fetches and hashes the [materialious.metainfo.xml](../materialious/electron/materialious.metainfo.xml) file.
5. Updates the Flatpak manifest (`us.materialio.Materialious.yml`) with the new URLs and checksums via `yq`.
6. Opens a pull request on the Flathub repository with the updated manifest.

### Android Release

Built by [prod-android.yml](../.github/workflows/prod-android.yml), triggered on pushes to `main` (with manual `workflow_dispatch` support).

**Build process:**

1. `npm ci` — install dependencies.
2. `npm ci` in `materialious/static/nodejsAndroid/` — install Node.js runtime modules used by [Capacitor-NodeJS](https://github.com/hampoelz/Capacitor-NodeJS) on Android.
3. `npm run build && npm prune --omit=dev` — build the web app.
4. `npx cap sync` — synchronize Capacitor with the Android platform.
5. `setup-java@v3` — configure JDK 21 (Zulu) with Gradle caching.
6. `bash gradlew assembleRelease` and `bash gradlew bundleRelease` — produce the APK and AAB.
7. [sign-android-release@v2](https://github.com/ilharp/sign-android-release/tree/v2) — sign both artifacts using the configured keystore.
8. [upload-release-action@v2](https://github.com/svenstaro/upload-release-action) — upload the signed APK and AAB to the GitHub release matching the version from `package.json`.
