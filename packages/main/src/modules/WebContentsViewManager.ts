import type {AppModule} from '../AppModule.js';
import type {ModuleContext} from '../ModuleContext.js';
import {BrowserWindow, ipcMain, WebContentsView} from 'electron';
import {URL} from 'node:url';

type LayoutItem = {
  id: string;
  url: string;
  bounds: {x: number; y: number; width: number; height: number};
};

export class WebContentsViewManager implements AppModule {
  readonly #allowedOrigins?: Set<string>;
  readonly #viewsByWindow = new WeakMap<
    BrowserWindow,
    Map<string, {view: WebContentsView; url?: string}>
  >();

  constructor({allowedOrigins}: {allowedOrigins?: Set<string>} = {}) {
    this.#allowedOrigins = allowedOrigins;
  }

  enable({app}: ModuleContext): Promise<void> | void {
    ipcMain.handle('webcontents-view:sync', (event, items: LayoutItem[]) => {
      if (!Array.isArray(items)) {
        return;
      }

      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return;
      }

      const viewMap = this.#getOrCreateViewMap(window);
      const seen = new Set<string>();

      for (const item of items) {
        if (!item || typeof item.id !== 'string') {
          continue;
        }

        seen.add(item.id);
        let entry = viewMap.get(item.id);

        if (!entry) {
          const view = new WebContentsView({
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
            },
          });
          entry = {view};
          viewMap.set(item.id, entry);
          window.contentView.addChildView(view);
        }

        if (typeof item.url === 'string' && item.url.length > 0) {
          try {
            this.#allowedOrigins?.add(new URL(item.url).origin);
          } catch {
            // Ignore invalid URLs; the view will fail to load them anyway.
          }

          if (!entry.url || entry.url !== item.url) {
            entry.url = item.url;
            void entry.view.webContents.loadURL(item.url);
          }
        }

        entry.view.setBounds({
          x: Math.max(0, Math.round(item.bounds.x)),
          y: Math.max(0, Math.round(item.bounds.y)),
          width: Math.max(0, Math.round(item.bounds.width)),
          height: Math.max(0, Math.round(item.bounds.height)),
        });
      }

      for (const [id, entry] of viewMap) {
        if (seen.has(id)) {
          continue;
        }

        window.contentView.removeChildView(entry.view);
        entry.view.webContents.close();
        viewMap.delete(id);
      }
    });

    app.on('browser-window-created', (_, window) => {
      window.on('closed', () => {
        const viewMap = this.#viewsByWindow.get(window);
        if (!viewMap) {
          return;
        }

        for (const entry of viewMap.values()) {
          entry.view.webContents.close();
        }
      });
    });
  }

  #getOrCreateViewMap(window: BrowserWindow) {
    let viewMap = this.#viewsByWindow.get(window);
    if (!viewMap) {
      viewMap = new Map();
      this.#viewsByWindow.set(window, viewMap);
    }

    return viewMap;
  }
}

export function createWebContentsViewManager(...args: ConstructorParameters<typeof WebContentsViewManager>) {
  return new WebContentsViewManager(...args);
}
