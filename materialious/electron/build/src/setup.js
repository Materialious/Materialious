"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElectronCapacitorApp = void 0;
exports.setupReloadWatcher = setupReloadWatcher;
exports.setupContentSecurityPolicy = setupContentSecurityPolicy;
const tslib_1 = require("tslib");
const electron_1 = require("@capacitor-community/electron");
const chokidar_1 = tslib_1.__importDefault(require("chokidar"));
const electron_2 = require("electron");
const electron_is_dev_1 = tslib_1.__importDefault(require("electron-is-dev"));
const electron_serve_1 = tslib_1.__importDefault(require("electron-serve"));
const electron_window_state_1 = tslib_1.__importDefault(require("electron-window-state"));
const path_1 = require("path");
// Define components for a watcher to detect when the webapp is changed so we can reload in Dev mode.
const reloadWatcher = {
    debouncer: null,
    ready: false,
    watcher: null,
};
function setupReloadWatcher(electronCapacitorApp) {
    reloadWatcher.watcher = chokidar_1.default
        .watch((0, path_1.join)(electron_2.app.getAppPath(), 'app'), {
        ignored: /[/\\]\./,
        persistent: true,
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
class ElectronCapacitorApp {
    constructor(capacitorFileConfig, trayMenuTemplate, appMenuBarMenuTemplate) {
        var _a, _b;
        this.MainWindow = null;
        this.SplashScreen = null;
        this.TrayIcon = null;
        this.TrayMenuTemplate = [
            new electron_2.MenuItem({ label: 'Quit App', role: 'quit' }),
        ];
        this.AppMenuBarMenuTemplate = [
            { role: process.platform === 'darwin' ? 'appMenu' : 'fileMenu' },
            { role: 'viewMenu' },
        ];
        this.CapacitorFileConfig = capacitorFileConfig;
        this.customScheme = (_b = (_a = this.CapacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.customUrlScheme) !== null && _b !== void 0 ? _b : 'capacitor-electron';
        if (trayMenuTemplate) {
            this.TrayMenuTemplate = trayMenuTemplate;
        }
        if (appMenuBarMenuTemplate) {
            this.AppMenuBarMenuTemplate = appMenuBarMenuTemplate;
        }
        // Setup our web app loader, this lets us load apps like react, vue, and angular without changing their build chains.
        this.loadWebApp = (0, electron_serve_1.default)({
            directory: (0, path_1.join)(electron_2.app.getAppPath(), 'app'),
            scheme: this.customScheme,
        });
    }
    // Helper function to load in the app.
    async loadMainWindow(thisRef) {
        await thisRef.loadWebApp(thisRef.MainWindow);
    }
    // Expose the mainWindow ref for use outside of the class.
    getMainWindow() {
        return this.MainWindow;
    }
    getCustomURLScheme() {
        return this.customScheme;
    }
    async init() {
        var _a, _b, _c, _d;
        const icon = electron_2.nativeImage.createFromPath((0, path_1.join)(electron_2.app.getAppPath(), 'assets', process.platform === 'win32' ? 'appIcon.ico' : 'appIcon.png'));
        this.mainWindowState = (0, electron_window_state_1.default)({
            defaultWidth: 1000,
            defaultHeight: 800,
        });
        // Setup preload script path and construct our main window.
        const preloadPath = (0, path_1.join)(electron_2.app.getAppPath(), 'build', 'src', 'preload.js');
        this.MainWindow = new electron_2.BrowserWindow({
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
                preload: preloadPath,
            },
        });
        this.mainWindowState.manage(this.MainWindow);
        if (this.CapacitorFileConfig.backgroundColor) {
            this.MainWindow.setBackgroundColor(this.CapacitorFileConfig.electron.backgroundColor);
        }
        // If we close the main window with the splashscreen enabled we need to destory the ref.
        this.MainWindow.on('closed', () => {
            var _a;
            if (((_a = this.SplashScreen) === null || _a === void 0 ? void 0 : _a.getSplashWindow()) && !this.SplashScreen.getSplashWindow().isDestroyed()) {
                this.SplashScreen.getSplashWindow().close();
            }
        });
        // When the tray icon is enabled, setup the options.
        if ((_a = this.CapacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.trayIconAndMenuEnabled) {
            this.TrayIcon = new electron_2.Tray(icon);
            this.TrayIcon.on('double-click', () => {
                if (this.MainWindow) {
                    if (this.MainWindow.isVisible()) {
                        this.MainWindow.hide();
                    }
                    else {
                        this.MainWindow.show();
                        this.MainWindow.focus();
                    }
                }
            });
            this.TrayIcon.on('click', () => {
                if (this.MainWindow) {
                    if (this.MainWindow.isVisible()) {
                        this.MainWindow.hide();
                    }
                    else {
                        this.MainWindow.show();
                        this.MainWindow.focus();
                    }
                }
            });
            this.TrayIcon.setToolTip(electron_2.app.getName());
            this.TrayIcon.setContextMenu(electron_2.Menu.buildFromTemplate(this.TrayMenuTemplate));
        }
        // Setup the main manu bar at the top of our window.
        electron_2.Menu.setApplicationMenu(electron_2.Menu.buildFromTemplate(this.AppMenuBarMenuTemplate));
        // If the splashscreen is enabled, show it first while the main window loads then switch it out for the main window, or just load the main window from the start.
        if ((_b = this.CapacitorFileConfig.electron) === null || _b === void 0 ? void 0 : _b.splashScreenEnabled) {
            this.SplashScreen = new electron_1.CapacitorSplashScreen({
                imageFilePath: (0, path_1.join)(electron_2.app.getAppPath(), 'assets', (_d = (_c = this.CapacitorFileConfig.electron) === null || _c === void 0 ? void 0 : _c.splashScreenImageName) !== null && _d !== void 0 ? _d : 'splash.png'),
                windowWidth: 400,
                windowHeight: 400,
            });
            this.SplashScreen.init(this.loadMainWindow, this);
        }
        else {
            this.loadMainWindow(this);
        }
        // Security
        this.MainWindow.webContents.setWindowOpenHandler((details) => {
            if (!details.url.includes(this.customScheme)) {
                return { action: 'deny' };
            }
            else {
                return { action: 'allow' };
            }
        });
        this.MainWindow.webContents.on('will-navigate', (event, _newURL) => {
            if (!this.MainWindow.webContents.getURL().includes(this.customScheme)) {
                event.preventDefault();
            }
        });
        // Link electron plugins into the system.
        (0, electron_1.setupCapacitorElectronPlugins)();
        // When the web app is loaded we hide the splashscreen if needed and show the mainwindow.
        this.MainWindow.webContents.on('dom-ready', () => {
            var _a, _b;
            if ((_a = this.CapacitorFileConfig.electron) === null || _a === void 0 ? void 0 : _a.splashScreenEnabled) {
                this.SplashScreen.getSplashWindow().hide();
            }
            if (!((_b = this.CapacitorFileConfig.electron) === null || _b === void 0 ? void 0 : _b.hideMainWindowOnLaunch)) {
                this.MainWindow.show();
            }
            setTimeout(() => {
                if (electron_is_dev_1.default) {
                    this.MainWindow.webContents.openDevTools();
                }
                electron_1.CapElectronEventEmitter.emit('CAPELECTRON_DeeplinkListenerInitialized', '');
            }, 400);
        });
    }
}
exports.ElectronCapacitorApp = ElectronCapacitorApp;
// Set a CSP up for our application based on the custom scheme
function setupContentSecurityPolicy(customScheme) {
    electron_2.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: Object.assign({}, details.responseHeaders),
        });
    });
}
