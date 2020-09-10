import { createRouter, Options, Route, Router, State, SubscribeFn } from "router5";
import listenersPlugin, { ListenersPluginOptions, Listener } from "router5-plugin-listeners";
import persistentParamsPlugin from 'router5-plugin-persistent-params'; 
import browserPlugin from './lib/browser-plugin';
import { BrowserPluginOptions } from "./lib/browser-plugin/types"; 

export type WrapperConfig = Partial<Options> & BrowserPluginOptions & ListenersPluginOptions & { persistentParams?: string[] };

export type CoreRouter = Router & ListenersPluginOptions;

export type CoreRouterState = State;

export type CoreSubscribeFn = SubscribeFn;

export type RouteDefinition = Route;

export type CoreRoute = Route;

export type CoreRouterListener = Listener;

export type CreateRouterCoreOptions = {
    routes: Route[];
    config: WrapperConfig;
}

export type CreateRouterCore = (CreateRouterOptions: CreateRouterCoreOptions) => CoreRouter;

export const createRouterCore: CreateRouterCore = ({
    routes,
    config
}) => {
const {
    defaultRoute = '/',
    defaultParams = {},
    base = '',
    useHash = false,
    persistentParams = [],
    autoCleanUp = false,
    useQueryNavigation = true,
  } = config;

  const createRouterOptions: Partial<Options> = {
    defaultRoute,
    defaultParams,
  };

  const browserPluginParams: BrowserPluginOptions = {
    base,
    useHash,
    useQueryNavigation,
  };

  const listenersPluginParams: ListenersPluginOptions = {
    autoCleanUp
  };
  
  const router = createRouter(routes, createRouterOptions);
  router.usePlugin(browserPlugin(browserPluginParams));
  // router.usePlugin(customBrowserPlugin(browserPluginParams));
  router.usePlugin(listenersPlugin(listenersPluginParams));
  router.usePlugin(persistentParamsPlugin(persistentParams));
  return router;
}