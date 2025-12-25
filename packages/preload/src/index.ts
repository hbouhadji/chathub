import {sha256sum} from './nodeCrypto.js';
import {versions} from './versions.js';
import {ipcRenderer} from 'electron';

function send(channel: string, message: unknown): Promise<unknown> {
  return ipcRenderer.invoke(channel, message);
}

function on(channel: string, listener: (message: unknown) => void) {
  const handler = (_event: Electron.IpcRendererEvent, message: unknown) => listener(message);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

export {sha256sum, versions, send, on};
