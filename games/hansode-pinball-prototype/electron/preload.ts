import { contextBridge, ipcRenderer } from 'electron';

interface AppInfo {
  isDev: boolean;
  e2e: boolean;
  raf: boolean;
  smoke: boolean;
  version: string;
  platform: string;
  keyPoll: boolean;
}

const info = ipcRenderer.sendSync('app:info') as AppInfo;

contextBridge.exposeInMainWorld('hansode', {
  info,
  load: (name: string) => ipcRenderer.invoke('storage:load', name),
  save: (name: string, data: unknown) => ipcRenderer.invoke('storage:save', name, data),
  quit: () => ipcRenderer.send('app:quit'),
  setFullscreen: (on: boolean) => ipcRenderer.invoke('win:setFullscreen', on),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  onFullscreenChange: (cb: (on: boolean) => void) => {
    ipcRenderer.on('win:fullscreen', (_e, on: boolean) => cb(on));
  },
  a11yStatus: () => ipcRenderer.invoke('a11y:status'),
  watchKeys: (vks: number[]) => ipcRenderer.send('keys:watch', vks),
  onKeyPoll: (cb: (vk: number, down: boolean) => void) => {
    ipcRenderer.on('keys:poll', (_e, vk: number, down: boolean) => cb(vk, down));
  },
});
