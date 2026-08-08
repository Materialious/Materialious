import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
	getCapacitorElectronConfig,
	setupElectronDeepLinking
} from '@capacitor-community/electron';
import { mintPoTokenInJSDOM } from '@materialious/shared/jsdom';
import {
	createDownload,
	getDownloadSession,
	SabrStream,
	type DownloadFormatSelection
} from '@materialious/shared/download';
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';

// Graceful handling of unhandled errors.
unhandled();

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);

// If deeplinking is enabled then we will set it up here.
if (capacitorFileConfig.electron?.deepLinkingEnabled) {
	setupElectronDeepLinking(myCapacitorApp, {
		customProtocol: capacitorFileConfig.electron.deepLinkingCustomProtocol ?? 'mycapacitorapp'
	});
}

// If we are in Dev mode, use the file watcher components.
if (electronIsDev) {
	setupReloadWatcher(myCapacitorApp);
}

let allowInsecureSSL = false;

// Run Application
(async () => {
	// Wait for electron app to be ready.
	await app.whenReady();
	// Security - Set Content-Security-Policy based on whether or not we are in dev mode.
	setupContentSecurityPolicy(myCapacitorApp.getCustomURLScheme());
	// Initialize our app, build windows, and load content.
	await myCapacitorApp.init();
})();

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
	if (allowInsecureSSL) {
		event.preventDefault(); // prevent default behavior (blocking the cert)
		callback(true); // trust the certificate
	} else {
		callback(false); // reject others
	}
});

// Handle when all of our windows are close (platforms have their own expectations).
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// When the dock icon is clicked.
app.on('activate', async function () {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (myCapacitorApp.getMainWindow().isDestroyed()) {
		await myCapacitorApp.init();
	}
});

// Place all ipc or other electron api calls and custom functionality under this line
ipcMain.handle('generatePoToken', async (_, requestKey: string, visitorData: string) => {
	return await mintPoTokenInJSDOM(requestKey, visitorData);
});

ipcMain.handle('setAllowInsecureSSL', async (_, allow) => {
	allowInsecureSSL = allow;
	await session.defaultSession.clearAuthCache();
	await session.defaultSession.clearCache();

	return allowInsecureSSL;
});

ipcMain.handle('doUpdateCheck', async (_, disableAutoUpdate) => {
	// Check for updates if we are in a packaged app.
	autoUpdater.autoInstallOnAppQuit = !disableAutoUpdate;

	if (disableAutoUpdate) {
		await autoUpdater.checkForUpdatesAndNotify({
			title: 'Update Available',
			body: 'A new version is available.'
		});
	} else {
		await autoUpdater.checkForUpdatesAndNotify();
	}
});

ipcMain.handle('getDownloadFormats', async (_, videoId: string) => {
	const session = await getDownloadSession(videoId);
	const video = await session.getInfo(videoId);
	const sabrStream = new SabrStream(video);

	return {
		title: sabrStream.getTitle(),
		formats: sabrStream.getFormats().filter((format) => !format.hasText)
	};
});

ipcMain.handle(
	'downloadVideo',
	async (
		event,
		payload: { videoId: string; selection: DownloadFormatSelection }
	) => {
		const { videoId, selection } = payload;

		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) throw new Error('No window found');

		const session = await getDownloadSession(videoId);
		const video = await session.getInfo(videoId);

		const resolved = await createDownload({
			media: video,
			selection,
			onProgress: (progress) => {
				event.sender.send('download-progress', { videoId, progress });
			}
		});

		const { canceled, filePath } = await dialog.showSaveDialog(win, {
			title: 'Download video',
			defaultPath: resolved.filename,
			filters: [
				{ name: 'Media', extensions: [resolved.container] },
				{ name: 'All files', extensions: ['*'] }
			]
		});

		if (canceled || !filePath) {
			await resolved.close?.();
			return { canceled: true };
		}

		try {
			const nodeStream = Readable.fromWeb(
				resolved.stream as unknown as import('node:stream/web').ReadableStream
			);
			await pipeline(nodeStream, createWriteStream(filePath));
		} catch (err) {
			await resolved.close?.();
			throw err;
		} finally {
			await resolved.close?.();
		}

		return { path: filePath };
	}
);
