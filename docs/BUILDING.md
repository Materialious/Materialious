## Building

### Pull Request Checks

Every pull request to `main` runs automated checks before merging:

| Workflow                                                  | Trigger      | Checks                                                                                   |
| --------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| [pull-web.yml](../.github/workflows/pull-web.yml)         | PR to `main` | `npm install`, `npm run check` (Svelte type-checking), `npm run eslint`, `npm run build` |
| [pull-desktop.yml](../.github/workflows/pull-desktop.yml) | PR to `main` | Builds Electron app on macOS (x64) — no publish                                          |
| [pull-android.yml](../.github/workflows/pull-android.yml) | PR to `main` | Builds Android APK/AAB (unsigned, no upload)                                             |

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

| Runtime     | OS             | Format                            |
| ----------- | -------------- | --------------------------------- |
| `linux-x64` | ubuntu-latest  | deb, rpm, AppImage, snap, zip, 7z |
| `win-x64`   | windows-latest | NSIS installer, zip, 7z           |
| `osx-x64`   | macOS-latest   | macOS universal binary (`.dmg`)   |

**Build process:**

1. `npm ci` — install dependencies.
2. `npm run build && npm prune --omit=dev` — build the web app.
3. `npx cap sync @capacitor-community/electron` — synchronize Capacitor with the Electron platform.
4. [patch_capacitor_plugin.py](../materialious/electron/patch_capacitor_plugin.py) — removes the `@capawesome/capacitor-nodejs` plugin from the Electron build (not needed on desktop).
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

Built by [prod-android.yml](../.github/workflows/prod-android.yml) after a successful desktop workflow run. The workflow builds both standard Android and Android TV editions; see Android TV Release below.

**Build process:**

1. `npm ci` — install dependencies.
2. `npm ci` in `materialious/static/nodejsAndroid/` — install Node.js runtime modules used by [Capawesome Capacitor Node.js](https://github.com/capawesome-team/capacitor-plugins/tree/main/packages/nodejs) on Android.
3. `npm run build` — build the web app.
4. `npx cap sync` — synchronize Capacitor with the Android platform.
5. `npm prune --omit=dev` — remove development modules after Capacitor sync.
6. `setup-java@v5` — configure JDK 21 (Zulu) with Gradle caching.
7. `bash gradlew assembleRelease` and `bash gradlew bundleRelease` — produce the APKs and AAB.
8. Sign and verify the artifacts using the configured keystore.
9. Upload the signed artifacts to the GitHub release matching the version from `package.json`.

### Android TV Release

The same [Android release workflow](../.github/workflows/prod-android.yml) builds both the standard and TV editions after the **Build desktop** workflow completes successfully. It checks out the desktop run's commit and uploads to the existing GitHub release whose tag matches `materialious/package.json`. The Android workflow itself is not triggered directly by a push or manual dispatch.

The build matrix sets `ANDROID_TV_BUILD=false` for standard Android and `ANDROID_TV_BUILD=true` for TV. This value must remain consistent for `npm run build`, `npx cap sync`, and the Gradle build: it selects the TV updater in the web bundle, includes the Android APK updater plugin, and adds the `.tv` application ID suffix. The standard edition excludes the updater plugin. Gradle checks that the synced plugin manifest matches the selected edition.

Each edition produces a universal APK, APKs for `armeabi-v7a`, `arm64-v8a`, and `x86_64`, and an AAB. The workflow signs APKs with Android build-tools 36.0.0 and AABs with `jarsigner`, verifies their signatures, then uploads them with `gh release upload --clobber`. TV filenames include `-tv`, so the two editions have distinct release assets. A rerun replaces assets with matching names. The TV updater looks for `app-universal-release-tv-signed.apk` in the latest GitHub release; it can temporarily be unavailable while the Android workflow is still running.
