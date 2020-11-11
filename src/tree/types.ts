import RouteNode from "./RouteNode";

export interface BrowserOptions {
  forceDeactivate?: boolean;
  useHash?: boolean;
  hashPrefix?: string;
  base?: string | null;
  mergeState?: boolean;
  preserveHash?: boolean;
  useQueryNavigation?: boolean;
  sourceRoutes?: any[];
  defaultPath?: string;
  subRouteKey?: string;
}

export interface Browser {
  getBase(): string;
  pushState(state: HistoryState, title: string | null, path: string): void;
  replaceState(state: HistoryState, title: string | null, path: string): void;
  addPopstateListener(fn: any, opts: any): any;
  getLocation(opts: BrowserOptions): string;
  getState(): HistoryState;
  getHash(): string;
}

export interface HistoryState {
  [key: string]: any;
}

export type TreeCallback = (node: RouteNode) => void;
