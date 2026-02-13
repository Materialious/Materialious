import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
	getCapacitorElectronConfig,
	setupElectronDeepLinking
} from '@capacitor-community/electron';
import { app, ipcMain, session } from 'electron';
import electronIsDev from 'electron-is-dev';
import unhandled from 'electron-unhandled';
import { autoUpdater } from 'electron-updater';
import { JSDOM } from 'jsdom';
import type { IGetChallengeResponse } from 'youtubei.js';

import BG, { buildURL, GOOG_API_KEY, USER_AGENT, WebPoSignalOutput } from 'bgutils-js';
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
ipcMain.handle(
	'generatePoToken',
	async (_, requestKey: string, visitorData: string, challenge: IGetChallengeResponse) => {
		const youtubeUrl = 'https://www.youtube.com/';

		const dom = new JSDOM(
			'<!DOCTYPE html><html lang="en"><head><title>YouTube</title></head><body></body></html>',
			{
				url: youtubeUrl,
				referrer: youtubeUrl,
				userAgent: USER_AGENT
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

		if (!challenge.bg_challenge) {
			throw new Error('No BotGuard Token');
		}

		const interpreterUrl =
			challenge.bg_challenge.interpreter_url
				.private_do_not_access_or_else_trusted_resource_url_wrapped_value;
		const interpreterHash = challenge.bg_challenge.interpreter_hash;

		if (!interpreterUrl || !interpreterHash) {
			throw new Error(
				`Could not get integrity token. Interpreter Hash: ${challenge.bg_challenge?.interpreter_hash}`
			);
		}

		const interpreterResponse = await fetch(`https:${interpreterUrl}`, {
			headers: {
				'user-agent': USER_AGENT
			}
		});

		if (!interpreterResponse.ok) {
			throw new Error('Unable to fetch interpreter');
		}

		const interpreterJavascript = await interpreterResponse.text();

		if (interpreterJavascript) {
			new Function(interpreterJavascript)();
		} else throw new Error('Could not load VM');

		const botguardClient = await BG.BotGuardClient.create({
			program: challenge.bg_challenge.program,
			globalName: challenge.bg_challenge.global_name,
			globalObj: globalThis
		});

		const webPoSignalOutput: WebPoSignalOutput = [];
		const botguardResponse = await botguardClient.snapshot({ webPoSignalOutput });

		const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
			method: 'POST',
			headers: {
				'content-type': 'application/json+protobuf',
				'x-goog-api-key': GOOG_API_KEY,
				'x-user-agent': 'grpc-web-javacript/0.1'
			},
			body: JSON.stringify([requestKey, botguardResponse])
		});

		const integrityTokenResponseData = await integrityTokenResponse.json();
		const integrityToken = integrityTokenResponseData[0] as string | undefined;

		if (!integrityToken) {
			throw new Error(`Could not get integrity token. Interpreter Hash: ${interpreterHash}`);
		}

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
