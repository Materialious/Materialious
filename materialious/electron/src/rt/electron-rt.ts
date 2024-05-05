import { randomBytes } from 'crypto';
import { ipcRenderer, contextBridge } from 'electron';
import { EventEmitter } from 'events';

////////////////////////////////////////////////////////
// eslint-disable-next-line @typescript-eslint/no-var-requires
const plugins = require('./electron-plugins');

const randomId = (length = 5) => randomBytes(length).toString('hex');

const contextApi: {
  [plugin: string]: { [functionName: string]: () => Promise<any> };
} = {};

Object.keys(plugins).forEach((pluginKey) => {
  Object.keys(plugins[pluginKey])
    .filter((className) => className !== 'default')
    .forEach((classKey) => {
      const functionList = Object.getOwnPropertyNames(plugins[pluginKey][classKey].prototype).filter(
        (v) => v !== 'constructor'
      );

      if (!contextApi[classKey]) {
        contextApi[classKey] = {};
      }

      functionList.forEach((functionName) => {
        if (!contextApi[classKey][functionName]) {
          contextApi[classKey][functionName] = (...args) => ipcRenderer.invoke(`${classKey}-${functionName}`, ...args);
        }
      });

      // Events
      if (plugins[pluginKey][classKey].prototype instanceof EventEmitter) {
        const listeners: { [key: string]: { type: string; listener: (...args: any[]) => void } } = {};
        const listenersOfTypeExist = (type) =>
          !!Object.values(listeners).find((listenerObj) => listenerObj.type === type);

        Object.assign(contextApi[classKey], {
          addListener(type: string, callback: (...args) => void) {
            const id = randomId();

            // Deduplicate events
            if (!listenersOfTypeExist(type)) {
              ipcRenderer.send(`event-add-${classKey}`, type);
            }

            const eventHandler = (_, ...args) => callback(...args);

            ipcRenderer.addListener(`event-${classKey}-${type}`, eventHandler);
            listeners[id] = { type, listener: eventHandler };

            return id;
          },
          removeListener(id: string) {
            if (!listeners[id]) {
              throw new Error('Invalid id');
            }

            const { type, listener } = listeners[id];

            ipcRenderer.removeListener(`event-${classKey}-${type}`, listener);

            delete listeners[id];

            if (!listenersOfTypeExist(type)) {
              ipcRenderer.send(`event-remove-${classKey}-${type}`);
            }
          },
          removeAllListeners(type: string) {
            Object.entries(listeners).forEach(([id, listenerObj]) => {
              if (!type || listenerObj.type === type) {
                ipcRenderer.removeListener(`event-${classKey}-${listenerObj.type}`, listenerObj.listener);
                ipcRenderer.send(`event-remove-${classKey}-${listenerObj.type}`);
                delete listeners[id];
              }
            });
          },
        });
      }
    });
});

contextBridge.exposeInMainWorld('CapacitorCustomPlatform', {
  name: 'electron',
  plugins: contextApi,
});
////////////////////////////////////////////////////////
