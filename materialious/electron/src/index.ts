import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
	getCapacitorElectronConfig,
	setupElectronDeepLinking
} from '@capacitor-community/electron';
import type { MenuItemConstructorOptions } from 'electron';
import { app, ipcMain, MenuItem, session, webContents } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
import { JSDOM } from 'jsdom';

import BG, { buildURL, GOOG_API_KEY, USER_AGENT, WebPoSignalOutput } from 'bgutils-js';
import { ElectronCapacitorApp, setupContentSecurityPolicy, setupReloadWatcher } from './setup';

// Graceful handling of unhandled errors.
unhandled();

// Define our menu templates (these are optional)
const trayMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
	new MenuItem({ label: 'Quit App', role: 'quit' })
];
const appMenuBarMenuTemplate: (MenuItemConstructorOptions | MenuItem)[] = [
	{ role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
	{ role: 'viewMenu' }
];

// Get Config options from capacitor.config
const capacitorFileConfig: CapacitorElectronConfig = getCapacitorElectronConfig();

// Initialize our app. You can pass menu templates into the app here.
// const myCapacitorApp = new ElectronCapacitorApp(capacitorFileConfig);
const myCapacitorApp = new ElectronCapacitorApp(
	capacitorFileConfig,
	trayMenuTemplate,
	appMenuBarMenuTemplate
);

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
ipcMain.handle(
	'generatePoToken',
	async (_, bgChallenge: any, requestKey: string, visitorData: string) => {
		const youtubeUrl = 'https://www.youtube.com/';

		const dom = new JSDOM(
			'<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>',
			{
				url: youtubeUrl,
				referrer: youtubeUrl,
				origin: youtubeUrl,
				USER_AGENT
			}
		);

		Object.assign(globalThis, {
			window: dom.window,
			document: dom.window.document,
			location: dom.window.location,
			origin: dom.window.origin
		});

		if (!Reflect.has(globalThis, 'navigator')) {
			Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
		}

		const interpreterUrl =
			bgChallenge.interpreter_url.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
		const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
		const interpreterJavascript = await bgScriptResponse.text();

		if (interpreterJavascript) {
			new Function(interpreterJavascript)();
		} else throw new Error('Could not load VM');

		const botguardClient = await BG.BotGuardClient.create({
			program: bgChallenge.program,
			globalName: bgChallenge.global_name,
			globalObj: globalThis
		});

		const webPoSignalOutput: WebPoSignalOutput = [];
		const botguardResponse = await botguardClient.snapshot({ webPoSignalOutput });

		const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
			method: 'POST',
			headers: {
				'content-type': 'application/json+protobuf',
				'x-goog-api-key': GOOG_API_KEY,
				'x-user-agent': 'grpc-web-javascript/0.1'
			},
			body: JSON.stringify([requestKey, botguardResponse])
		});

		const integrityTokenResponseData = await integrityTokenResponse.json();

		if (typeof integrityTokenResponseData[0] !== 'string')
			throw new Error('Could not get integrity token');

		const integrityToken = integrityTokenResponseData[0];

		const integrityTokenBasedMinter = await BG.WebPoMinter.create(
			{ integrityToken },
			webPoSignalOutput
		);

		return await integrityTokenBasedMinter.mintAsWebsafeString(decodeURIComponent(visitorData));
	}
);

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
