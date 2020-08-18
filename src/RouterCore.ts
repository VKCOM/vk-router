import { createRouter, Options, Route, Router, State, SubscribeFn } from "router5";
import browserPlugin from "router5-plugin-browser";
import listenersPlugin, { ListenersPluginOptions, Listener } from "router5-plugin-listeners";
import persistentParamsPlugin from "router5-plugin-persistent-params"; 
import { BrowserPluginOptions } from 'router5-plugin-browser/dist/types'; 

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
    base = '.',
    useHash = false,
    persistentParams = [],
    autoCleanUp = false,
  } = config;

  const createRouterOptions: Partial<Options> = {
    defaultRoute,
    defaultParams,
  };

  const browserPluginParams: BrowserPluginOptions = {
    base,
    useHash,
  };

  const listenersPluginParams: ListenersPluginOptions = {
    autoCleanUp
  };
  
  const router = createRouter(routes, createRouterOptions);
  router.usePlugin(browserPlugin(browserPluginParams));
  router.usePlugin(listenersPlugin(listenersPluginParams));
  router.usePlugin(persistentParamsPlugin(persistentParams));
  return router;
}