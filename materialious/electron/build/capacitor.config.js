"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
    appId: 'us.materialio.app',
    appName: 'Materialious',
    webDir: 'build',
    bundledWebRuntime: false,
    plugins: {
        CapacitorHttp: {
            enabled: true
        }
    },
};
exports.default = config;
