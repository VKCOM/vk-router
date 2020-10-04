export interface NavigatorConfig {
  defaultRoute: string;
  base?: string;
  useHash?: boolean;
  persistentParams?: string[];
  useQueryNavigation?: boolean;
  subRouteKey?: string; 
  routeKey?: string;
}

export interface URLParamsCollection {
  [key: string]: any
}

export interface NavigatorParams {
  [key:string]: any,
  route?: {
    [key: string]: any;
  },
  subroute?: {
    [key: string]: any;
  }
} 

export interface NavigatorOptions {
  [key: string]: any;
  replace?: boolean;
  reload?: boolean;
}

export interface CreateNavigatorOptions {
  routes?: NavigatorRoute[];
  config?: NavigatorConfig 
}

export interface NavigatorRoute {
  [key: string]: any,
  name: string;
  path?: string;
  params?: NavigatorParams;
  subRoute?: boolean;
  updateUrl?: boolean;
  title?: string;
  children?: NavigatorRoute[],
}

export interface NavigatorCreateOptions {
  routes?: NavigatorRoute[];
  config?: NavigatorConfig;
}

export type NavigatorCreate = (
  options: NavigatorCreateOptions
) => Navigator;

export interface NavigatorSubRoutes {
  [key:string]: any,
} 

export interface NavigatorHistoryRecord extends NavigatorState {
}

export interface NavigatorState {
  route: string,
  subroute?: string,
  path?: string,
  history?: NavigatorHistoryRecord[],
  go?: Function,
  back?: VoidFunction,
  config?: NavigatorConfig,
  params: NavigatorParams,
  navigator?: any,
}

export interface NavigatorStatesToSubscriber {
  toState: NavigatorState; 
  fromState: NavigatorState;
}

export type NavigatorSubscriber = (state: NavigatorStatesToSubscriber) => void;
 
export interface Browser {
  getBase(): string
  pushState(state: HistoryState, title: string | null, path: string): void
  replaceState(state: HistoryState, title: string | null, path: string): void
  addPopstateListener(fn: any, opts: any): any
  getLocation(opts: NavigatorConfig): string
  getState(): HistoryState
  getHash(): string
}

export interface HistoryState {
  [key: string]: any
}
  
export interface HistoryRecord extends NavigatorState {
}