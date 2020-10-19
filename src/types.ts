export type NavigatorErrorLogger = (errorStr: string) => void;

export interface NavigatorConfig {
  defaultRoute: string;
  defaultParams?: any;
  queryParamsMode?: string;
  base?: string;
  useAdapter?: boolean;
  persistentParams?: string[];
  // useQueryNavigation?: boolean; // always true
  subRouteKey?: string;
  routeKey?: string;
  errorLogger?: NavigatorErrorLogger;
}

export interface URLParamsCollection {
  [key: string]: any;
}

export interface NavigatorParams {
  [key: string]: any;
  route?: {
    [key: string]: any;
  };
  subroute?: {
    [key: string]: any;
  };
}

export type NavigatorRouteProperties = Record<string, any>;

export interface NavigatorOptions {
  [key: string]: any;
  replace?: boolean;
  reload?: boolean;
}

export interface NavigatorRoute {
  [key: string]: any;
  name: string;
  path?: string;
  params?: NavigatorParams;
  subRoute?: boolean;
  updateUrl?: boolean;
  title?: string;
  children?: NavigatorRoute[];
}

export interface NavigatorCreateOptions {
  routes?: NavigatorRoute[];
  config?: NavigatorConfig;
}

export type NavigatorCreate = (options: NavigatorCreateOptions) => Navigator;

export interface NavigatorSubRoutes {
  [key: string]: any;
}

export interface NavigatorHistoryRecord extends NavigatorState {}

export interface NavigatorState {
  route: string;
  name?: string;
  subroute?: string;
  history?: NavigatorHistoryRecord[];
  params: NavigatorParams;
}

export interface NavigatorStatesToSubscriber {
  toState: NavigatorState;
  fromState: NavigatorState;
  route?: NavigatorState;
  previousRoute?: NavigatorState;
}

export type NavigatorSubscriber = (state: NavigatorStatesToSubscriber) => void;

export type NavigatorDone = (func?: any) => void;

export type NavigatorRouteHandler = (
  fromState: NavigatorState,
  toState: NavigatorState,
  done: NavigatorDone
) => void;

export type NavigatorRouteHandlerCollection = Record<
  string,
  NavigatorRouteHandler
>;

export interface Browser {
  getBase(): string;
  pushState(state: HistoryState, title: string | null, path: string): void;
  replaceState(state: HistoryState, title: string | null, path: string): void;
  addPopstateListener(fn: any, opts: any): any;
  addLinkInterceptorListener(fn: any, opts: any): any;
  getLocation(opts: NavigatorConfig): string;
  getState(): HistoryState;
  getHash(): string;
}

export interface HistoryState {
  [key: string]: any;
}

export interface HistoryRecord extends NavigatorState {}
