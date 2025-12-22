import type { CapacitorElectronConfig } from '@capacitor-community/electron';
import {
	CapacitorSplashScreen,
	CapElectronEventEmitter,
	setupCapacitorElectronPlugins
} from '@capacitor-community/electron';
import { USER_AGENT } from 'bgutils-js';
import path from 'node:path';
import chokidar from 'chokidar';
import type { MenuItemConstructorOptions } from 'electron';
import {
	app,
	BrowserWindow,
	Menu,
	MenuItem,
	nativeImage,
	session,
	shell,
	Tray,
	globalShortcut
} from 'electron';
import electronIsDev from 'electron-is-dev';
import electronServe from 'electron-serve';
import windowStateKeeper from 'electron-window-state';
import { join } from 'path';

// Define components for a watcher to detect when the webapp is changed so we can reload in Dev mode.
const reloadWatcher = {
	debouncer: null,
	ready: false,
	watcher: null
};
export function setupReloadWatcher(electronCapacitorApp: ElectronCapacitorApp): void {
	reloadWatcher.watcher = chokidar
		.watch(join(app.getAppPath(), 'app'), {
			ignored: /[/\\]\./,
			persistent: true
		})
		.on('ready', () => {
			reloadWatcher.ready = true;
		})
		.on('all', (_event, _path) => {
			if (reloadWatcher.ready) {
				clearTimeout(reloadWatcher.debouncer);
				reloadWatcher.debouncer = setTimeout(async () => {
					electronCapacitorApp.getMainWindow().webContents.reload();
					reloadWatcher.ready = false;
					clearTimeout(reloadWatcher.debouncer);
					reloadWatcher.debouncer = null;
					reloadWatcher.watcher = null;
					setupReloadWatcher(electronCapacitorApp);
				}, 1500);
			}
		});
}

// Define our class to manage our app.
export class ElectronCapacitorApp {
	private MainWindow: BrowserWindow | null = null;
	private SplashScreen: CapacitorSplashScreen | null = null;
	private TrayIcon: Tray | null = null;
	private CapacitorFileConfig: CapacitorElectronConfig;
	private TrayMenuTemplate: (MenuItem | MenuItemConstructorOptions)[] = [
		new MenuItem({ label: 'Quit App', role: 'quit' })
	];
	private mainWindowState;
	private loadWebApp;
	private customScheme: string;

	constructor(
		capacitorFileConfig: CapacitorElectronConfig,
		trayMenuTemplate?: (MenuItemConstructorOptions | MenuItem)[]
	) {
		this.CapacitorFileConfig = capacitorFileConfig;

		this.customScheme = this.CapacitorFileConfig.electron?.customUrlScheme ?? 'capacitor-electron';

		if (trayMenuTemplate) {
			this.TrayMenuTemplate = trayMenuTemplate;
		}

		// Setup our web app loader, this lets us load apps like react, vue, and angular without changing their build chains.
		this.loadWebApp = electronServe({
			directory: join(app.getAppPath(), 'app'),
			scheme: this.customScheme
		});
	}

	// Helper function to load in the app.
	private async loadMainWindow(thisRef: any) {
		await thisRef.loadWebApp(thisRef.MainWindow);
	}

	// Expose the mainWindow ref for use outside of the class.
	getMainWindow(): BrowserWindow {
		return this.MainWindow;
	}

	getCustomURLScheme(): string {
		return this.customScheme;
	}

	async init(): Promise<void> {
		const icon = nativeImage.createFromPath(
			join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'appIcon.ico' : 'appIcon.png')
		);
		this.mainWindowState = windowStateKeeper({
			defaultWidth: 1920,
			defaultHeight: 1080
		});
		// Setup preload script path and construct our main window.
		const preloadPath = join(app.getAppPath(), 'build', 'src', 'preload.js');
		this.MainWindow = new BrowserWindow({
			icon,
			show: false,
			x: this.mainWindowState.x,
			y: this.mainWindowState.y,
			width: this.mainWindowState.width,
			height: this.mainWindowState.height,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: true,
				webSecurity: false,
				// Use preload to inject the electron varriant overrides for capacitor plugins.
				// preload: join(app.getAppPath(), "node_modules", "@capacitor-community", "electron", "dist", "runtime", "electron-rt.js"),
				preload: preloadPath
			}
		});
		this.mainWindowState.manage(this.MainWindow);

		if (this.CapacitorFileConfig.backgroundColor) {
			this.MainWindow.setBackgroundColor(this.CapacitorFileConfig.electron.backgroundColor);
		}

		// If we close the main window with the splashscreen enabled we need to destory the ref.
		this.MainWindow.on('closed', () => {
			if (
				this.SplashScreen?.getSplashWindow() &&
				!this.SplashScreen.getSplashWindow().isDestroyed()
			) {
				this.SplashScreen.getSplashWindow().close();
			}
		});

		// When the tray icon is enabled, setup the options.
		if (this.CapacitorFileConfig.electron?.trayIconAndMenuEnabled) {
			this.TrayIcon = new Tray(icon);
			this.TrayIcon.on('double-click', () => {
				if (this.MainWindow) {
					if (this.MainWindow.isVisible()) {
						this.MainWindow.hide();
					} else {
						this.MainWindow.show();
						this.MainWindow.focus();
					}
				}
			});
			this.TrayIcon.on('click', () => {
				if (this.MainWindow) {
					if (this.MainWindow.isVisible()) {
						this.MainWindow.hide();
					} else {
						this.MainWindow.show();
						this.MainWindow.focus();
					}
				}
			});
			this.TrayIcon.setToolTip(app.getName());
			this.TrayIcon.setContextMenu(Menu.buildFromTemplate(this.TrayMenuTemplate));
		}

		// Disable Menu Bar at the top.
		Menu.setApplicationMenu(null);

		// If the splashscreen is enabled, show it first while the main window loads then switch it out for the main window, or just load the main window from the start.
		if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
			this.SplashScreen = new CapacitorSplashScreen({
				imageFilePath: join(
					app.getAppPath(),
					'assets',
					this.CapacitorFileConfig.electron?.splashScreenImageName ?? 'splash.png'
				),
				windowWidth: 400,
				windowHeight: 400
			});
			this.SplashScreen.init(this.loadMainWindow, this);
		} else {
			this.loadMainWindow(this);
		}
		globalShortcut.register('Control+Shift+I', () => {
			this.MainWindow.webContents.toggleDevTools();
		});

		// Security
		this.MainWindow.webContents.setWindowOpenHandler((details) => {
			shell.openExternal(details.url);
			return { action: 'deny' };
		});
		this.MainWindow.webContents.on('will-navigate', (event, _newURL) => {
			if (!this.MainWindow.webContents.getURL().includes(this.customScheme)) {
				event.preventDefault();
			}
		});
		// Link electron plugins into the system.
		setupCapacitorElectronPlugins();

		// When the web app is loaded we hide the splashscreen if needed and show the mainwindow.
		this.MainWindow.webContents.on('dom-ready', () => {
			if (this.CapacitorFileConfig.electron?.splashScreenEnabled) {
				this.SplashScreen.getSplashWindow().hide();
			}
			if (!this.CapacitorFileConfig.electron?.hideMainWindowOnLaunch) {
				this.MainWindow.show();
			}
			setTimeout(() => {
				if (electronIsDev) {
					this.MainWindow.webContents.openDevTools();
				}
				CapElectronEventEmitter.emit('CAPELECTRON_DeeplinkListenerInitialized', '');
			}, 400);
		});

		// remove so we can register each time as we run the app.
		app.removeAsDefaultProtocolClient('materialious');

		// If we are running a non-packaged version of the app && on windows
		if (process.env.NODE_ENV === 'development' && process.platform === 'win32') {
			// Set the path of electron.exe and your app.
			// These two additional parameters are only available on windows.
			app.setAsDefaultProtocolClient('materialious', process.execPath, [
				path.resolve(process.argv[1])
			]);
		} else {
			app.setAsDefaultProtocolClient('materialious');
		}

		const gotTheLock = app.requestSingleInstanceLock();

		if (!gotTheLock) {
			app.quit();
		} else {
			app.on('second-instance', (event, commandLine, workingDirectory) => {
				// Someone tried to run a second instance, we should focus our window.
				if (this.MainWindow) {
					if (this.MainWindow.isMinimized()) this.MainWindow.restore();
					this.MainWindow.focus();
				}
			});
		}
	}
}

// Set a CSP up for our application based on the custom scheme
export function setupContentSecurityPolicy(customScheme: string): void {
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders
			}
		});
	});

	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		const uri = new URL(details.url);

		details.requestHeaders['User-Agent'] = USER_AGENT;
		details.requestHeaders['origin'] = uri.origin;
		details.requestHeaders['host'] = uri.host;

		callback({ requestHeaders: details.requestHeaders });
	});
}
