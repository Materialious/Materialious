"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const electron_1 = require("electron");
const events_1 = require("events");
////////////////////////////////////////////////////////
// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugins = require('./electron-plugins');
const randomId = (length = 5) => (0, crypto_1.randomBytes)(length).toString('hex');
const contextApi = {};
Object.keys(plugins).forEach((pluginKey) => {
    Object.keys(plugins[pluginKey])
        .filter((className) => className !== 'default')
        .forEach((classKey) => {
        const functionList = Object.getOwnPropertyNames(plugins[pluginKey][classKey].prototype).filter((v) => v !== 'constructor');
        if (!contextApi[classKey]) {
            contextApi[classKey] = {};
        }
        functionList.forEach((functionName) => {
            if (!contextApi[classKey][functionName]) {
                contextApi[classKey][functionName] = (...args) => electron_1.ipcRenderer.invoke(`${classKey}-${functionName}`, ...args);
            }
        });
        // Events
        if (plugins[pluginKey][classKey].prototype instanceof events_1.EventEmitter) {
            const listeners = {};
            const listenersOfTypeExist = (type) => !!Object.values(listeners).find((listenerObj) => listenerObj.type === type);
            Object.assign(contextApi[classKey], {
                addListener(type, callback) {
                    const id = randomId();
                    // Deduplicate events
                    if (!listenersOfTypeExist(type)) {
                        electron_1.ipcRenderer.send(`event-add-${classKey}`, type);
                    }
                    const eventHandler = (_, ...args) => callback(...args);
                    electron_1.ipcRenderer.addListener(`event-${classKey}-${type}`, eventHandler);
                    listeners[id] = { type, listener: eventHandler };
                    return id;
                },
                removeListener(id) {
                    if (!listeners[id]) {
                        throw new Error('Invalid id');
                    }
                    const { type, listener } = listeners[id];
                    electron_1.ipcRenderer.removeListener(`event-${classKey}-${type}`, listener);
                    delete listeners[id];
                    if (!listenersOfTypeExist(type)) {
                        electron_1.ipcRenderer.send(`event-remove-${classKey}-${type}`);
                    }
                },
                removeAllListeners(type) {
                    Object.entries(listeners).forEach(([id, listenerObj]) => {
                        if (!type || listenerObj.type === type) {
                            electron_1.ipcRenderer.removeListener(`event-${classKey}-${listenerObj.type}`, listenerObj.listener);
                            electron_1.ipcRenderer.send(`event-remove-${classKey}-${listenerObj.type}`);
                            delete listeners[id];
                        }
                    });
                },
            });
        }
    });
});
electron_1.contextBridge.exposeInMainWorld('CapacitorCustomPlatform', {
    name: 'electron',
    plugins: contextApi,
});
////////////////////////////////////////////////////////
