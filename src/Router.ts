import { createRouter } from "router5";
import browserPlugin from "router5-plugin-browser";
import listenersPlugin from "router5-plugin-listeners";
import persistentParamsPlugin from "router5-plugin-persistent-params";
import { getRouteData } from './utils';

export interface NavigatorConfig {
  defaultRoute?: string,
  base?: string,
  useHash?: boolean,
}

export interface CreateRouterInstanceOptions {
  routes: any[];
  config?: NavigatorConfig
  panelsOrder?:any,
  modals?:any,
  tooltips?:any,
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
  panelsOrder, 
  config = defaultConfig,
}) => {
  const {
    defaultRoute
  } = config;

  const defaultParams = {

  };

  const browserPluginParams = {

  };

  const listenersPluginParams = {

  };

  const persistentPluginParams = {

  };

  const router = createRouter(routes, {
    defaultRoute,
    defaultParams,
  });

  
  router.usePlugin(browserPlugin(browserPluginParams));
  router.usePlugin(listenersPlugin(listenersPluginParams));
  router.usePlugin(persistentParamsPlugin(persistentPluginParams));
  router.start();
  // Временное решение проблемы с модалками и перезагрузкой страницы
  const routeData = getRouteData(router.getState(), routes, panelsOrder);
  if (routeData.isModal) {
    window.history.back();
  }
  
  //router.navigate(router.getState().name, defaultParams, { replace: true });
  return router;
};

export default createRouter;
