import { createRouter, Options, Route } from "router5";
import browserPlugin from "router5-plugin-browser";
import listenersPlugin, { ListenersPluginOptions } from "router5-plugin-listeners";
import persistentParamsPlugin from "router5-plugin-persistent-params"; 
import { BrowserPluginOptions } from 'router5-plugin-browser/dist/types'; 

export type NavigatorConfig = Partial<Options> & BrowserPluginOptions & ListenersPluginOptions & { persistentParams?: string[] };

export type RouteDefinition = Route;

export interface CreateRouterInstanceOptions {
  routes: any[];
  config: NavigatorConfig 
}

export type CreateRouterInstance = (
  options: CreateRouterInstanceOptions
) => any;

const defaultConfig: NavigatorConfig = {    
  base: ".",
  useHash: false,  
};

export const createRouterInstance: CreateRouterInstance = ({
  routes, 
  config = defaultConfig,
}) => {
  const {
    defaultRoute,
    defaultParams,
    base,
    useHash,
    persistentParams,
    autoCleanUp,
  } = config;

  const createRouterOptions: Partial<Options> = {
    defaultRoute,
    defaultParams,
  };

  const browserPluginParams: BrowserPluginOptions = {
    base,
    useHash,
  };

  const listenersPluginParams = {
    autoCleanUp
  };
 
  const router = createRouter(routes, createRouterOptions);

  router.usePlugin(browserPlugin(browserPluginParams));
  router.usePlugin(listenersPlugin(listenersPluginParams));
  if(persistentParams && persistentParams.length){
    router.usePlugin(persistentParamsPlugin(persistentParams));
  } 
  return router;
};

export default createRouter;
