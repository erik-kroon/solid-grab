import {
  createOpenFileUrl,
  freeze,
  generateSnippet,
  getElementContext,
  getSource,
  getStackContext,
  openFile,
  unfreeze,
} from "../primitives.js";
import type {
  SolidGrabAction,
  SolidGrabActionContext,
  SolidGrabAPI,
  SolidGrabElementContext,
  SolidGrabOptions,
  SolidGrabPlugin,
  SolidGrabPluginHooks,
  SolidGrabState,
} from "../types.js";
import { getComputedStylePreview, isSolidGrabOverlayElement } from "../utils/dom.js";

const OVERLAY_ATTR = "data-solid-grab-overlay";

interface RegisteredPlugin {
  plugin: SolidGrabPlugin;
  hooks: SolidGrabPluginHooks;
  actions: SolidGrabAction[];
  cleanup?: () => void;
}

const writeClipboard = async (content: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content);
    return true;
  }
  return false;
};

export const createRuntime = (initialOptions: SolidGrabOptions = {}): SolidGrabAPI => {
  let options: SolidGrabOptions = {
    enabled: true,
    holdKey: "Alt",
    keyHoldDuration: 350,
    maxHtmlLength: 700,
    ...initialOptions,
  };
  const plugins = new Map<string, RegisteredPlugin>();
  const controller = new AbortController();
  const state: SolidGrabState = {
    isActive: false,
    isDragging: false,
    targetElement: null,
    selectedElements: [],
    dragBounds: null,
    isCopying: false,
    lastCopySucceeded: null,
  };

  const host = document.createElement("div");
  host.setAttribute(OVERLAY_ATTR, "");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .box, .drag { position: fixed; border: 1px solid rgb(41 128 185 / .85); background: rgb(41 128 185 / .10); border-radius: 4px; pointer-events: none; transition: all 70ms ease-out; }
    .drag { border-style: dashed; background: rgb(37 99 235 / .08); }
    .label { position: fixed; max-width: min(460px, calc(100vw - 16px)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 6px; border-radius: 4px; color: white; background: #1f2937; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; pointer-events: none; box-shadow: 0 2px 8px rgb(0 0 0 / .18); }
    .toolbar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 6px; align-items: center; padding: 6px; border: 1px solid rgb(0 0 0 / .12); border-radius: 8px; background: white; color: #111827; box-shadow: 0 8px 30px rgb(0 0 0 / .18); pointer-events: auto; font: 12px ui-sans-serif, system-ui, sans-serif; }
    button { border: 0; border-radius: 6px; padding: 6px 9px; background: #f3f4f6; color: inherit; font: inherit; cursor: pointer; }
    button[data-active="true"] { background: #2563eb; color: white; }
    .toast { position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%); padding: 6px 10px; border-radius: 6px; background: #111827; color: white; font: 12px ui-sans-serif, system-ui, sans-serif; pointer-events: none; }
  `;
  const root = document.createElement("div");
  shadow.append(style, root);

  const box = document.createElement("div");
  box.className = "box";
  box.hidden = true;
  const dragBox = document.createElement("div");
  dragBox.className = "drag";
  dragBox.hidden = true;
  const label = document.createElement("div");
  label.className = "label";
  label.hidden = true;
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.textContent = "Grab";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.textContent = "Copy";
  copyButton.hidden = true;
  const actionsRoot = document.createElement("div");
  actionsRoot.style.cssText = "display:flex;gap:6px;align-items:center;";
  toolbar.append(toggleButton, copyButton, actionsRoot);
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.hidden = true;
  root.append(box, dragBox, label, toolbar, toast);

  let toastTimer: ReturnType<typeof window.setTimeout> | undefined;
  let holdTimer: ReturnType<typeof window.setTimeout> | undefined;
  let holdActivated = false;
  let dragStart: { x: number; y: number } | null = null;
  let justDragged = false;

  const pluginHooks = (): SolidGrabPluginHooks[] =>
    Array.from(plugins.values()).map((entry) => entry.hooks);

  const callHook = <K extends keyof SolidGrabPluginHooks>(
    name: K,
    ...args: Parameters<NonNullable<SolidGrabPluginHooks[K]>>
  ): void => {
    for (const hooks of pluginHooks()) {
      const hook = hooks[name] as ((...hookArgs: typeof args) => void) | undefined;
      hook?.(...args);
    }
  };

  const reduceCopyContent = async (content: string, elements: Element[]): Promise<string> => {
    let next = content;
    for (const hooks of pluginHooks()) {
      if (hooks.transformCopyContent) {
        next = await hooks.transformCopyContent(next, elements);
      }
    }
    return next;
  };

  const reduceHtmlContent = async (content: string, elements: Element[]): Promise<string> => {
    let next = content;
    for (const hooks of pluginHooks()) {
      if (hooks.transformHtmlContent) {
        next = await hooks.transformHtmlContent(next, elements);
      }
    }
    return next;
  };

  const reduceStylesContent = async (content: string, elements: Element[]): Promise<string> => {
    let next = content;
    for (const hooks of pluginHooks()) {
      if (hooks.transformStylesContent) {
        next = await hooks.transformStylesContent(next, elements);
      }
    }
    return next;
  };

  const reduceSnippet = async (snippet: string, element: Element): Promise<string> => {
    let next = snippet;
    for (const hooks of pluginHooks()) {
      if (hooks.transformSnippet) {
        next = await hooks.transformSnippet(next, element);
      }
    }
    return next;
  };

  const showToast = (message: string): void => {
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1200);
  };

  const renderTarget = async (element: Element | null): Promise<void> => {
    if (!element || !state.isActive) {
      box.hidden = true;
      dragBox.hidden = true;
      label.hidden = true;
      copyButton.hidden = true;
      actionsRoot.replaceChildren();
      return;
    }

    const rect = element.getBoundingClientRect();
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    box.hidden = false;

    const context = await getElementContext(element);
    label.textContent = context.componentName
      ? `${context.componentName} ${context.source.filePath ?? ""}`.trim()
      : `${context.tagName} fallback`;
    label.style.left = `${Math.max(4, rect.left)}px`;
    label.style.top = `${Math.max(4, rect.top - 24)}px`;
    label.hidden = false;
    copyButton.hidden = false;
    renderActionButtons(element);
  };

  const setActive = (active: boolean): void => {
    if (state.isActive === active) return;
    state.isActive = active;
    toggleButton.dataset.active = String(active);
    toggleButton.textContent = active ? "Grabbing" : "Grab";
    if (!active) {
      state.targetElement = null;
      state.selectedElements = [];
      state.isDragging = false;
      state.dragBounds = null;
      dragStart = null;
      unfreeze();
      void renderTarget(null);
      callHook("onDeactivate");
      return;
    }
    freeze();
    callHook("onActivate");
  };

  const pickElement = (event: MouseEvent): Element | null => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element || isSolidGrabOverlayElement(element)) return null;
    return element;
  };

  const updateDragBox = (bounds: SolidGrabState["dragBounds"]): void => {
    state.dragBounds = bounds;
    if (!bounds) {
      dragBox.hidden = true;
      return;
    }
    dragBox.style.left = `${bounds.x}px`;
    dragBox.style.top = `${bounds.y}px`;
    dragBox.style.width = `${bounds.width}px`;
    dragBox.style.height = `${bounds.height}px`;
    dragBox.hidden = false;
  };

  const boundsFromPoints = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ): NonNullable<SolidGrabState["dragBounds"]> => {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {
      x,
      y,
      width: Math.abs(start.x - end.x),
      height: Math.abs(start.y - end.y),
    };
  };

  const rectsIntersect = (a: DOMRect, b: NonNullable<SolidGrabState["dragBounds"]>): boolean =>
    a.width > 0 &&
    a.height > 0 &&
    a.right >= b.x &&
    a.left <= b.x + b.width &&
    a.bottom >= b.y &&
    a.top <= b.y + b.height;

  const getElementsInBounds = (bounds: NonNullable<SolidGrabState["dragBounds"]>): Element[] => {
    const elements = Array.from(document.body.querySelectorAll("*"));
    const candidates: Element[] = [];
    for (const element of elements) {
      if (isSolidGrabOverlayElement(element)) continue;
      if (element === document.body || element === document.documentElement) continue;
      if (rectsIntersect(element.getBoundingClientRect(), bounds)) candidates.push(element);
    }
    return candidates
      .filter(
        (element) =>
          !candidates.some((candidate) => element !== candidate && element.contains(candidate)),
      )
      .slice(0, 25);
  };

  const copyText = async (content: string, elements: Element[]): Promise<boolean> => {
    const success = await writeClipboard(content);
    state.lastCopySucceeded = success;
    callHook("onAfterCopy", elements, success);
    if (success) {
      callHook("onCopySuccess", elements, content);
      showToast("Copied Solid context");
    }
    return success;
  };

  const copyElements = async (elements: Element[]): Promise<boolean> => {
    const filteredElements = elements.filter((element) => !isSolidGrabOverlayElement(element));
    if (filteredElements.length === 0) return false;
    state.isCopying = true;
    try {
      for (const hooks of pluginHooks()) {
        await hooks.onBeforeCopy?.(filteredElements);
      }
      const custom = options.getContent ? await options.getContent(filteredElements) : null;
      const rawSnippets = custom
        ? [custom]
        : await generateSnippet(filteredElements, {
            includeStyles: options.includeStyles,
            maxHtmlLength: options.maxHtmlLength,
          });
      const transformedSnippets = await Promise.all(
        rawSnippets.map((snippet, index) =>
          reduceSnippet(snippet, filteredElements[index] ?? filteredElements[0]),
        ),
      );
      const content = await reduceCopyContent(
        transformedSnippets.join("\n\n---\n\n"),
        filteredElements,
      );
      return await copyText(content, filteredElements);
    } catch (error) {
      state.lastCopySucceeded = false;
      const normalized = error instanceof Error ? error : new Error(String(error));
      callHook("onCopyError", normalized);
      return false;
    } finally {
      state.isCopying = false;
    }
  };

  const copyElement = async (element: Element): Promise<boolean> => copyElements([element]);

  const getActions = (): SolidGrabAction[] => [
    {
      id: "copy",
      label: "Copy",
      onAction: (context) => context.copy(),
    },
    {
      id: "open-in-editor",
      label: "Open",
      onAction: (context) => context.openSource(),
    },
    {
      id: "copy-html",
      label: "HTML",
      onAction: async (context) => {
        const content = await reduceHtmlContent(
          `${context.element.outerHTML}\n\n${context.context.stackString}`.trim(),
          context.elements,
        );
        return context.writeText(content);
      },
    },
    {
      id: "copy-styles",
      label: "Styles",
      onAction: async (context) => {
        const styles = Object.entries(getComputedStylePreview(context.element))
          .map(([name, value]) => `${name}: ${value};`)
          .join("\n");
        const content = await reduceStylesContent(styles, context.elements);
        return context.writeText(content);
      },
    },
    ...Array.from(plugins.values()).flatMap((entry) => entry.actions),
  ];

  const openSource = async (context: SolidGrabElementContext): Promise<boolean> => {
    const filePath = context.source.filePath;
    if (!filePath) return false;

    for (const hooks of pluginHooks()) {
      const handled = await hooks.onOpenFile?.(filePath, context.source.lineNumber);
      if (handled) return true;
    }

    let url = createOpenFileUrl(filePath, context.source.lineNumber);
    for (const hooks of pluginHooks()) {
      if (hooks.transformOpenFileUrl) {
        url = hooks.transformOpenFileUrl(url, filePath, context.source.lineNumber);
      }
    }
    return await openFile(filePath, context.source.lineNumber, url);
  };

  const createActionContext = async (actionElement: Element): Promise<SolidGrabActionContext> => {
    const elements = [actionElement];
    const context = await getElementContext(actionElement, options);
    return {
      element: actionElement,
      elements,
      context,
      copy: () => copyElement(actionElement),
      writeText: (content) => copyText(content, elements),
      openSource: () => openSource(context),
    };
  };

  const runAction = async (id: string, element: Element): Promise<boolean> => {
    const action = getActions().find((candidate) => candidate.id === id);
    if (!action || isSolidGrabOverlayElement(element)) return false;
    try {
      state.isCopying = true;
      const context = await createActionContext(element);
      await action.onAction(context);
      return true;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      callHook("onCopyError", normalized);
      return false;
    } finally {
      state.isCopying = false;
    }
  };

  const renderActionButtons = (element: Element): void => {
    actionsRoot.replaceChildren();
    for (const action of getActions().filter((candidate) => candidate.id !== "copy")) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          void runAction(action.id, element);
        },
        { signal: controller.signal },
      );
      actionsRoot.append(button);
    }
  };

  const onMove = (event: MouseEvent): void => {
    if (!state.isActive) return;
    if (dragStart) {
      const bounds = boundsFromPoints(dragStart, { x: event.clientX, y: event.clientY });
      if (bounds.width > 4 || bounds.height > 4) {
        state.isDragging = true;
        updateDragBox(bounds);
      }
      return;
    }
    const element = pickElement(event);
    if (!element || element === state.targetElement) return;
    state.targetElement = element;
    callHook("onElementHover", element);
    void renderTarget(element);
  };

  const onPointerDown = (event: MouseEvent): void => {
    if (!state.isActive || event.button !== 0) return;
    const element = pickElement(event);
    if (!element) return;
    dragStart = { x: event.clientX, y: event.clientY };
    state.isDragging = false;
  };

  const onPointerUp = (event: MouseEvent): void => {
    if (!dragStart) return;
    const bounds = boundsFromPoints(dragStart, { x: event.clientX, y: event.clientY });
    dragStart = null;
    if (!state.isDragging || bounds.width <= 4 || bounds.height <= 4) {
      state.isDragging = false;
      updateDragBox(null);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    justDragged = true;
    window.setTimeout(() => {
      justDragged = false;
    }, 0);
    state.isDragging = false;
    updateDragBox(null);
    const selected = getElementsInBounds(bounds);
    state.selectedElements = selected;
    if (selected.length > 0) void copyElements(selected);
  };

  const onClick = (event: MouseEvent): void => {
    if (!state.isActive) return;
    if (justDragged) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const element = pickElement(event);
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    state.targetElement = element;
    void copyElement(element);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === options.holdKey && !state.isActive && !holdTimer) {
      holdTimer = window.setTimeout(() => {
        holdActivated = true;
        holdTimer = undefined;
        setActive(true);
      }, options.keyHoldDuration ?? 350);
    }
    if (event.key === "Escape" && state.isActive) {
      event.preventDefault();
      setActive(false);
    }
    if ((event.key === "c" || event.key === "C") && state.isActive && state.targetElement) {
      event.preventDefault();
      void copyElement(state.targetElement);
    }
  };

  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== options.holdKey) return;
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = undefined;
    }
    if (holdActivated) {
      holdActivated = false;
      setActive(false);
    }
  };

  const api: SolidGrabAPI = {
    init: () => api,
    dispose: () => {
      controller.abort();
      if (holdTimer) window.clearTimeout(holdTimer);
      for (const entry of plugins.values()) entry.cleanup?.();
      plugins.clear();
      host.remove();
      if (window.__SOLID_GRAB__ === api) delete window.__SOLID_GRAB__;
    },
    activate: () => setActive(true),
    deactivate: () => setActive(false),
    toggle: () => setActive(!state.isActive),
    copyElement,
    getSource,
    getStackContext,
    getState: () => ({ ...state }),
    setOptions: (nextOptions) => {
      options = { ...options, ...nextOptions };
    },
    registerPlugin: (plugin) => {
      api.unregisterPlugin(plugin.name);
      const setup = plugin.setup?.(api);
      plugins.set(plugin.name, {
        plugin,
        hooks: { ...plugin.hooks, ...setup?.hooks },
        actions: [...(plugin.actions ?? []), ...(setup?.actions ?? [])],
        cleanup: setup?.cleanup,
      });
      if (state.targetElement) renderActionButtons(state.targetElement);
    },
    unregisterPlugin: (name) => {
      const registered = plugins.get(name);
      registered?.cleanup?.();
      plugins.delete(name);
      if (state.targetElement) renderActionButtons(state.targetElement);
    },
    getPlugins: () => Array.from(plugins.values()).map((entry) => entry.plugin),
    getActions,
    runAction,
  };

  toggleButton.addEventListener("click", () => api.toggle(), { signal: controller.signal });
  copyButton.addEventListener(
    "click",
    () => {
      if (state.targetElement) void api.copyElement(state.targetElement);
    },
    { signal: controller.signal },
  );
  document.addEventListener("mousemove", onMove, { capture: true, signal: controller.signal });
  document.addEventListener("mousedown", onPointerDown, {
    capture: true,
    signal: controller.signal,
  });
  document.addEventListener("mouseup", onPointerUp, { capture: true, signal: controller.signal });
  document.addEventListener("click", onClick, { capture: true, signal: controller.signal });
  document.addEventListener("keydown", onKey, { capture: true, signal: controller.signal });
  document.addEventListener("keyup", onKeyUp, { capture: true, signal: controller.signal });
  document.body.append(host);

  return api;
};
