## Building
### Web Deployment (via Docker)
Materialious supports web deployment through Docker.

- The build process starts with the [Dockerfile](../materialious/Dockerfile).
- Placeholder environment variables are injected into a `.env` file, which are later replaced by the [replace_env_vars.sh](../materialious/replace_env_vars.sh) script.
- The application is served using NGINX, configured with [nginx.conf](../materialious/nginx.conf).
- Deployment and building are handled via [docker/build-push-action@v5](https://github.com/docker/build-push-action/tree/v5) using the workflow defined in [prod-web.yml](../.github/workflows/prod-web.yml).

### Desktop Release (via GitHub Releases)
Materialious desktop builds are handled through GitHub using [prod-desktop.yml](../.github/workflows/prod-desktop.yml).

- First, the typical build steps are run: `npm install` and `npm run build`.
- We utilize [Capacitor](https://capacitorjs.com) with `@capacitor-community/electron` to integrate Electron into the project. The command `npx cap sync @capacitor-community/electron` is used to synchronize the latest build.
- The [patch_capacitor_plugin.py](../materialious/electron/patch_capacitor_plugin.py) script removes the [Capacitor-NodeJS](https://github.com/hampoelz/Capacitor-NodeJS) plugin from the desktop build, as it's not required and currently has no better alternative.
- From here, the process follows standard [electron-builder](https://www.electron.build/) steps to complete the build.

### Desktop Release (via Flathub)
- After all workflows have completed, the [prod-flatpak](https://github.com/Materialious/Materialious/blob/update/readme/.github/workflows/prod-flathub.yml) workflow runs.
- It downloads the AMD and ARM packages from the latest release.
- It computes SHA-256 hashes for both packages.
- It inserts the hashes into the Flatpak manifest.
- It automatically opens a pull request on our [Flathub repository](https://github.com/flathub/us.materialio.Materialious).


### Android Release
Android builds are handled using the workflow [prod-android.yml](../.github/workflows/prod-android.yml).

- After running the standard `npm install` and `npm run build` commands, we install the modules located in [nodejs-android/](../materialious/static/nodejs-android/) for [Capacitor-NodeJS](https://github.com/hampoelz/Capacitor-NodeJS).
- The `npx cap sync` command is used to synchronize with [Capacitor](https://capacitorjs.com).
- The Android build is processed using [setup-java](https://github.com/actions/setup-java/tree/v3/), followed by signing the APK with [sign-android-release](https://github.com/ilharp/sign-android-release/tree/v1.0.4).
