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
  readonly #viewPreloadPath?: string;
  readonly #viewsByWindow = new WeakMap<
    BrowserWindow,
    Map<string, {view: WebContentsView; url?: string; bounds?: LayoutItem['bounds']}>
  >();
  readonly #viewsById = new Map<number, {window: BrowserWindow; view: WebContentsView}>();

  constructor({allowedOrigins, viewPreloadPath}: {allowedOrigins?: Set<string>; viewPreloadPath?: string} = {}) {
    this.#allowedOrigins = allowedOrigins;
    this.#viewPreloadPath = viewPreloadPath;
  }

  enable({app}: ModuleContext): Promise<void> | void {
    ipcMain.on('webcontents-view:wheel', (event, payload) => {
      const entry = this.#viewsById.get(event.sender.id);
      if (!entry) {
        return;
      }

      const deltaX = (payload as {deltaX?: number} | undefined)?.deltaX;
      if (typeof deltaX !== 'number' || !deltaX) {
        return;
      }

      entry.window.webContents.send('webcontents-view:scroll-x', {deltaX});
    });

    ipcMain.handle('webcontents-view:reload', (event, payload) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return;
      }

      const id = (payload as {id?: string} | undefined)?.id;
      if (!id) {
        return;
      }

      const viewMap = this.#viewsByWindow.get(window);
      const entry = viewMap?.get(id);
      if (!entry) {
        return;
      }

      entry.view.webContents.reload();
    });

    ipcMain.handle('webcontents-view:fill-inputs', async (event, payload) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return;
      }

      const text = (payload as {text?: string} | undefined)?.text ?? '';
      const selectors = (payload as {selectors?: Array<{id: string; selector: string}>} | undefined)?.selectors ?? [];
      const selectorMap = new Map(selectors.map(entry => [entry.id, entry.selector]));

      const viewMap = this.#viewsByWindow.get(window);
      if (!viewMap) {
        return;
      }

      const scriptBody = `
        const nodes = Array.from(document.querySelectorAll(selector));
        if (nodes.length === 0) return 0;
        for (const node of nodes) {
          if ('value' in node) {
            node.value = text;
            node.dispatchEvent(new InputEvent('input', {bubbles: true}));
            node.dispatchEvent(new Event('change', {bubbles: true}));
            continue;
          }

          if (node.isContentEditable) {
            node.textContent = text;
            node.dispatchEvent(new InputEvent('input', {bubbles: true}));
            node.dispatchEvent(new Event('change', {bubbles: true}));
          }
        }
        return nodes.length;
      `;

      for (const [id, entry] of viewMap) {
        const selector = selectorMap.get(id);
        if (!selector) {
          continue;
        }

        try {
          const perViewScript = `(function(text, selector) {${scriptBody}})(${JSON.stringify(
            text,
          )}, ${JSON.stringify(selector)});`;
          await entry.view.webContents.executeJavaScript(perViewScript, true);
        } catch {
          // Ignore per-view failures to keep best-effort behavior.
        }
      }
    });

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
          const preloadPath = this.#viewPreloadPath;
          const view = new WebContentsView({
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: false,
              preload: preloadPath,
            },
          });
          entry = {view};
          viewMap.set(item.id, entry);
          window.contentView.addChildView(view);
          this.#viewsById.set(view.webContents.id, {window, view});
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

        const bounds = {
          x: Math.round(item.bounds.x),
          y: Math.round(item.bounds.y),
          width: Math.max(0, Math.round(item.bounds.width)),
          height: Math.max(0, Math.round(item.bounds.height)),
        };
        entry.bounds = bounds;
        entry.view.setBounds(bounds);
      }

      for (const [id, entry] of viewMap) {
        if (seen.has(id)) {
          continue;
        }

        window.contentView.removeChildView(entry.view);
        this.#viewsById.delete(entry.view.webContents.id);
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
          this.#viewsById.delete(entry.view.webContents.id);
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
