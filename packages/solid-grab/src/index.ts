import { createNoopApi } from "./core/noop.js";
import { createRuntime } from "./core/runtime.js";
import type { SolidGrabAPI, SolidGrabOptions, SolidGrabPlugin } from "./types.js";

export {
  generateSnippet,
  getElementContext,
  getSource,
  getStackContext,
  openFile,
} from "./primitives.js";
export type {
  GenerateSnippetOptions,
  SolidGrabAPI,
  SolidGrabElementContext,
  SolidGrabOptions,
  SolidGrabPlugin,
  SolidGrabSourceInfo,
  SolidGrabStackFrame,
} from "./types.js";

let globalApi: SolidGrabAPI | null = null;
const pendingPlugins: SolidGrabPlugin[] = [];

export const getGlobalApi = (): SolidGrabAPI | null => {
  if (typeof window === "undefined") return globalApi;
  return window.__SOLID_GRAB__ ?? globalApi;
};

const setGlobalApi = (api: SolidGrabAPI | null): void => {
  globalApi = api;
  if (typeof window === "undefined") return;
  if (api) {
    window.__SOLID_GRAB__ = api;
  } else {
    delete window.__SOLID_GRAB__;
  }
};

const flushPendingPlugins = (api: SolidGrabAPI): void => {
  while (pendingPlugins.length > 0) {
    const plugin = pendingPlugins.shift();
    if (plugin) api.registerPlugin(plugin);
  }
};

export const init = (options?: SolidGrabOptions): SolidGrabAPI => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return createNoopApi();
  }
  if (window.__SOLID_GRAB_DISABLED__ || options?.enabled === false) {
    const api = createNoopApi();
    setGlobalApi(api);
    return api;
  }
  const existing = getGlobalApi();
  if (existing) {
    if (options) existing.setOptions(options);
    return existing;
  }
  const api = createRuntime(options);
  setGlobalApi(api);
  flushPendingPlugins(api);
  window.dispatchEvent(new CustomEvent("solid-grab:init", { detail: api }));
  return api;
};

export const registerPlugin = (plugin: SolidGrabPlugin): void => {
  const api = getGlobalApi();
  if (api) {
    api.registerPlugin(plugin);
    return;
  }
  pendingPlugins.push(plugin);
};

export const unregisterPlugin = (name: string): void => {
  const api = getGlobalApi();
  if (api) {
    api.unregisterPlugin(name);
    return;
  }
  const index = pendingPlugins.findIndex((plugin) => plugin.name === name);
  if (index !== -1) pendingPlugins.splice(index, 1);
};

if (
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  !window.__SOLID_GRAB_DISABLED__
) {
  init();
}
