import type { SolidGrabAPI } from "../types.js";

const noop = () => {};

export const createNoopApi = (): SolidGrabAPI => ({
  init: () => createNoopApi(),
  dispose: noop,
  activate: noop,
  deactivate: noop,
  toggle: noop,
  copyElement: () => Promise.resolve(false),
  getSource: () => Promise.resolve(null),
  getStackContext: () => Promise.resolve(""),
  getState: () => ({
    isActive: false,
    targetElement: null,
    isCopying: false,
    lastCopySucceeded: null,
  }),
  setOptions: noop,
  registerPlugin: noop,
  unregisterPlugin: noop,
  getPlugins: () => [],
});
