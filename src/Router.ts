import { createRouter } from 'router5';
import browserPlugin, {} from 'router5-plugin-browser';
import listenersPlugin from 'router5-plugin-listeners' 
import persistentParamsPlugin from 'router5-plugin-persistent-params';


export interface PluginsParams {
  browserPluginParams?: any,
  listenersPluginParams?: any,
  persistentPluginParams?: any,
}


export interface CreateRouterInstanceOptions {
  routes:any[],
  defaultRoute?: any,
  defaultParams?: any,
  pluginsParams?: PluginsParams ,
};

export type CreateRouterInstance = (options: CreateRouterInstanceOptions) => any;

const defaultPluginsParams: PluginsParams = {
  browserPluginParams: {
    base: '.',
    useHash: true,
  },
  listenersPluginParams: null,
  persistentPluginParams: null,
}

export const createRouterInstance: CreateRouterInstance = ({
  routes,
  defaultRoute,
  defaultParams,
  pluginsParams = defaultPluginsParams,
}) => {
  const {
    browserPluginParams,
    listenersPluginParams,
    persistentPluginParams,
  } = pluginsParams; 

const router = createRouter(routes, {
  defaultRoute,
  defaultParams,
});

router.usePlugin(browserPlugin(browserPluginParams));
router.usePlugin(listenersPlugin(listenersPluginParams))
router.usePlugin(persistentParamsPlugin(persistentPluginParams));
router.start();

router.navigate(router.getState().name, defaultParams, { replace: true });
  return router;
}
export default createRouter;
