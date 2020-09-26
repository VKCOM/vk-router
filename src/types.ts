import { CoreConfig } from './RouterCore';

export interface URLParamsCollection {
    [key: string]: any
}

export interface NavigatorParams {
    [key:string]: any,
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

export type NavigatorConfig = CoreConfig;

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

export interface NavigatorHistoryRecord {
  route?: string,
  subRoute?: string,
  path?: string,
  subRouteParams?: NavigatorParams,     
  params? : NavigatorParams
}

export interface NavigatorState {
    route?: string,
    path?: string,
    subRoute?: string,
    history?: NavigatorHistoryRecord[],
    go?: Function,
    back?: VoidFunction,
    config?: NavigatorConfig,
    params?: NavigatorParams,
    subRouteParams?: NavigatorParams,
    navigator?: any,
}

export interface NavigatorStatesToSubscriber {
  toState: NavigatorState; 
  fromState: NavigatorState;
}

export type NavigatorSubscriber = (state: NavigatorStatesToSubscriber) => void;