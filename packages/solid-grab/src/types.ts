export interface SolidGrabSourceInfo {
  filePath: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  componentName: string | null;
  metadataId: string | null;
}

export interface SolidGrabStackFrame {
  functionName: string | null;
  fileName: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

export interface SolidGrabElementContext {
  element: Element;
  tagName: string;
  componentName: string | null;
  displayName: string | null;
  source: SolidGrabSourceInfo;
  selector: string;
  htmlPreview: string;
  textPreview: string | null;
  stackString: string;
  stackFrames: SolidGrabStackFrame[];
  styles: Record<string, string>;
  fallbackReason: string | null;
}

export interface GenerateSnippetOptions {
  includeStyles?: boolean;
  maxHtmlLength?: number;
}

export interface SolidGrabState {
  isActive: boolean;
  targetElement: Element | null;
  isCopying: boolean;
  lastCopySucceeded: boolean | null;
}

export interface SolidGrabOptions {
  enabled?: boolean;
  includeStyles?: boolean;
  maxHtmlLength?: number;
  getContent?: (elements: Element[]) => string | Promise<string>;
}

export interface SolidGrabPluginHooks {
  onActivate?: () => void;
  onDeactivate?: () => void;
  onElementHover?: (element: Element) => void;
  onBeforeCopy?: (elements: Element[]) => void | Promise<void>;
  transformSnippet?: (snippet: string, element: Element) => string | Promise<string>;
  transformCopyContent?: (content: string, elements: Element[]) => string | Promise<string>;
  onAfterCopy?: (elements: Element[], success: boolean) => void;
  onCopySuccess?: (elements: Element[], content: string) => void;
  onCopyError?: (error: Error) => void;
}

export interface SolidGrabActionContext {
  element: Element;
  elements: Element[];
  context: SolidGrabElementContext;
  copy: () => Promise<boolean>;
}

export interface SolidGrabAction {
  id: string;
  label: string;
  onAction: (context: SolidGrabActionContext) => void | Promise<void>;
}

export interface SolidGrabPlugin {
  name: string;
  actions?: SolidGrabAction[];
  hooks?: SolidGrabPluginHooks;
  setup?: (api: SolidGrabAPI) => void | {
    actions?: SolidGrabAction[];
    hooks?: SolidGrabPluginHooks;
    cleanup?: () => void;
  };
}

export interface SolidGrabAPI {
  init: () => SolidGrabAPI;
  dispose: () => void;
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  copyElement: (element: Element) => Promise<boolean>;
  getSource: (element: Element) => Promise<SolidGrabSourceInfo | null>;
  getStackContext: (element: Element) => Promise<string>;
  getState: () => SolidGrabState;
  setOptions: (options: SolidGrabOptions) => void;
  registerPlugin: (plugin: SolidGrabPlugin) => void;
  unregisterPlugin: (name: string) => void;
  getPlugins: () => SolidGrabPlugin[];
}

declare global {
  interface Window {
    __SOLID_GRAB__?: SolidGrabAPI;
    __SOLID_GRAB_DISABLED__?: boolean;
  }
}
