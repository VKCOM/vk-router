import { Navigator } from "./Navigator";
import RouteNode from "./tree/RouteNode";

export type NavigatorErrorLogger = (errorStr: string) => void;

export interface NavigatorConfig {
  defaultRoute: string;
  rootPage: string;
  defaultParams?: any;
  queryParamsMode?: string;
  base?: string;
  persistentParams?: string[];
  subRouteKey?: string;
  routeKey?: string;
  preserveHash?: boolean;
  errorLogger?: NavigatorErrorLogger;
}

export interface NavigatorGetStateOptions {
  withoutHistory?: boolean
  routeParams?: boolean
}

export type NavigatorGetState = (options?: NavigatorGetStateOptions) => NavigatorState;

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

export interface NavigatorHistoryRecord extends NavigatorState {}

export interface NavigatorState {
  page: string;
  modal?: string;
  history?: NavigatorHistoryRecord[];
  params: NavigatorParams;
  activeNodes?: RouteNode[];
}

export interface NavigatorStatesToSubscriber {
  toState: NavigatorState;
  fromState: NavigatorState;
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
  addLinkInterceptorListener(buildState: any, go: any): any;
  getLocation(opts: NavigatorConfig, search?: string): string;
  getState(): HistoryState;
  getHash(): string;
}

export interface HistoryState {
  [key: string]: any;
}

export interface HistoryRecord extends NavigatorState {}
