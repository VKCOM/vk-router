import { createRouter, Options } from "router5";
import browserPlugin from "router5-plugin-browser";
import listenersPlugin, { ListenersPluginOptions } from "router5-plugin-listeners";
import persistentParamsPlugin from "router5-plugin-persistent-params"; 
import { BrowserPluginOptions } from 'router5-plugin-browser/dist/types';

export type NavigatorConfig = Partial<Options> & BrowserPluginOptions & ListenersPluginOptions;

export interface CreateRouterInstanceOptions {
  routes: any[];
  config?: NavigatorConfig
  panelsOrder?:any,
  panels?:any,
  modals?:any, 
  views?: any,
}

export type CreateRouterInstance = (
  options: CreateRouterInstanceOptions
) => any;

const defaultConfig: NavigatorConfig = {    
  base: ".",
  useHash: true,  
};

export const createRouterInstance: CreateRouterInstance = ({
  routes, 
  config = defaultConfig,
}) => {
  const {
    defaultRoute,
    base,
    useHash,
  } = config;

  const createRouterOptions: Partial<Options> = {
    defaultRoute,
    defaultParams: {}
  };

  const browserPluginParams: BrowserPluginOptions = {
    
  };

  const listenersPluginParams = {

  };

  const persistentPluginParams = {

  };

  const router = createRouter(routes, createRouterOptions);

  
  router.usePlugin(browserPlugin(browserPluginParams));
  router.usePlugin(listenersPlugin(listenersPluginParams));
  router.usePlugin(persistentParamsPlugin(persistentPluginParams));
   
  return router;
};

export default createRouter;
