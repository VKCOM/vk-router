import { createRouterCore, WrapperConfig as NavigatorConfig, CoreRouter, CoreRoute, CoreSubscribeFn, CoreRouterState } from './RouterCore';  
import { getUrlParams, buildTokenStringForPath } from './utils';
import { ERROR_INVALID_PARAMS } from './constants';
import { DoneFn } from 'router5/dist/types/base';
import { buildUrlParams } from './lib/browser-plugin/utils';

export interface CreateNavigatorOptions {
  routes?: NavigatorRoute[];
  config?: NavigatorConfig 
}

export type CreateNavigator = (
  options: CreateNavigatorOptions
) => Navigator;

export interface NavigatorSubRoutes {
  [key:string]: any,
}

export interface NavigatorParams {
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
    navigator?: Navigator,
}

export interface NavigatorStatesToSubscriber {
  toState: NavigatorState; 
  fromState: NavigatorState;
}

export type NavigatorSubscriber = (state: NavigatorStatesToSubscriber) => void;

export interface NavigatorRoute {
  name: string;
  path?: string;
  params?: NavigatorParams;
  subRoute?: boolean;
  title?: string;
  children?: NavigatorRoute[],
}

interface NavigatorRouteParams {
  [key: string] : any;
}

interface NavigatorRouteProperties {
  [key:string]: any
}

const defaultConfig: NavigatorConfig = {    
  base: ".",
  defaultRoute: '/',
  useHash: false,  
};

export class Navigator {

  public state: NavigatorState = {};
  public prevState: NavigatorState = {};
  public history:NavigatorHistoryRecord[] = [];
  public routes: NavigatorRoute[] = [];
  public routeProperties: NavigatorRouteProperties = {};
  public config: NavigatorConfig = {};
  

  private subscribers: NavigatorSubscriber[] = [];  
  private router: CoreRouter;

  constructor ({ routes, config }: CreateNavigatorOptions) { 
    this.routes = routes;  
    this.config = config;

    this.router = createRouterCore({
      routes: this.proccessRoutes(this.routes), 
      config: this.config
    }); 
    this.router.subscribe(this.syncNavigatorStateWithCore); 
    this.router.start();
    const initState = this.router.matchUrl(window.location.href); 

    if(initState){ 
      const { name: route, path, params } = initState;
      this.history = [{ route: name, path, params }];
      
      this.setState({
          route,
          path,
          go: this.go,
          back: this.back,
          config,
          params,
          navigator: this,
      });
    }  
    this.buildFakeHistory();
    this.handlePopStateEvent();
  } 

  private handlePopStateEvent  = () => {}

  private buildFakeHistory = () => { 
    /**
     *  Достраиваем историю в том случае если мы перешли напрямую 
     *  достраиваем и в стек браузера и в стек истории модуля
     */
    const browserHistory = window.history; 
    if(browserHistory.length <= 2){ 
      /**
       * 3 случая - навигация обычная, через hash и через query params
       */
      const { origin, hash, pathname, search } = window.location; 
      if(this.config.useQueryNavigation){
        const { route, subroute, queryParams } = getUrlParams(search);
        let pathQuery = '';
        let baseRoute = '';

        if(route){
          const paths = route.split('.'); 
          paths.forEach((path: string) => {
            const searchPath = buildUrlParams({
              route: pathQuery += (pathQuery.length ? `.${path}`: path),
              ...queryParams
            })
            baseRoute = `${origin}/?${searchPath}`;       
            browserHistory.pushState(null, null, baseRoute);
          });
        }

        if(subroute){
          const subpaths = subroute.split('.');
          let subPathQuery = '';
          subpaths.forEach((subpath: string) => {
            const searchPath = buildUrlParams({
              subroute: subPathQuery += (subPathQuery.length ? `.${subpath}`: subpath),
              ...queryParams
            })
            const url = `${baseRoute}&${searchPath}`;
            browserHistory.pushState(null, null, url);
          });
        }
       
      } else {
        const hashMode = !!hash;
        const address = hashMode ? hash.replace('#', '') : pathname; 
        const paths = address.split('/').filter((path: string) => path);
        let pathstr = hashMode ? '#': ''; 
        paths.forEach((path: string) => {  
            pathstr += `/${path}`;      
            browserHistory.pushState(null, null, `${origin}${pathstr}`);
        });
      }  
    }
  }

  /**
   * Метод для обхода входящей коллекции роутов по заданному пути
   * нужен, т.к. router5 не хранит внутри себя доп свойств
   * TODO: найти более эффективный способ добираться до свойств
   */
  private getRouteData = (path:string): NavigatorRoute | null => {
    const pathSegments = path.split('.');   
    let routeData = null; 
    let pathSegmentIndex = 0;
    const target = pathSegments[pathSegments.length - 1];

    const lookForSegment = (routes: NavigatorRoute[])=> {
      for(let i = 0; i < routes.length; ++i){
        const route = routes[i];
        const pathName = pathSegments[pathSegmentIndex];
        if(route.name === pathName){
          if(route.name === target){
            routeData = route;
            break;
          }         
          if(Array.isArray(route.children)){
            pathSegmentIndex +=1;
            lookForSegment(route.children);
          }
          break;
        }
      };
    };

    lookForSegment(this.routes);

    return routeData;
  }

  private iterateRouteTree = (routes:NavigatorRoute[], callback: (el:NavigatorRoute, index: number)=> any) => {
    if(Array.isArray(routes)){
      routes.forEach((el, index)=>{
        callback(el, index)
        if(Array.isArray(el.children)){
          this.iterateRouteTree(el.children, callback);
        }
      })
    }
  } 

  private proccessRoutes=(routes: NavigatorRoute[]): CoreRoute[] => {   
    this.iterateRouteTree(routes, (route:NavigatorRoute) =>{
        const { name, params = {}, path: routePath } = route;
        const path = routePath || this.buildPath(name, params);  
        // TODO: полностью удалить path из модуля 
        route.path = path;
    });
 
    return routes as CoreRoute[];
  }

  private broadCastState = () => {
     const toState = this.getState();
     const fromState = this.getPrevState();
     this.subscribers.forEach((subscriber: NavigatorSubscriber) => subscriber({ toState, fromState }));
  }
  
  private setState = (state: Partial<NavigatorState>) => {
    this.prevState = {...this.state};
    this.state = {...this.state, ...state };
    this.broadCastState();
  }

  private getParentRoute = (path: string): string => {
    const resultArr = path.split('.');
    resultArr.pop();
    return resultArr.length > 1 ? resultArr.join('.') : resultArr[0];
  }

  private syncNavigatorStateWithCore: CoreSubscribeFn = (state) => {
    const { route: coreState, previousRoute: prevCoreState } = state; 
    const { name, params = {}, path } = coreState;  
    // генерируется из параметров просовываемых модулем browser в том случае если обновились на subroute
    const prevCoreStateFromUrlParams = { name: params.prevRoute, params };
    
    const { name: prevName, params: prevParams = {} } = prevCoreState || prevCoreStateFromUrlParams; 
    // очистка параметров идущих наружу
    const cleanParams = ({ prevRoute, isSubRoute, subroute, route, ...params }: NavigatorParams = {}) => params;

    /**
     * Проверяем следующее состояние роутера
     * если следующий роут - это subroute текущего, то:
     * route =  остается тем же самым
     * subroute = устанавливается в текущее значениe
     * если предыдущий роут - тоже subrout
     * то оставляем текущий роут
     */

    const routeData = this.getRouteData(name);
    const prevRouteIsSubRoute = this.state.subRoute === prevName; 
    const isSubRoute = (routeData && routeData.subRoute) || !!params.subroute;
    
    const route = isSubRoute 
      ? prevRouteIsSubRoute 
        ? this.state.route 
        : prevName
      : name;

    const subRoute = isSubRoute 
    ?  params.subroute 
      ? params.subroute 
      : name 
    : null;
  
    const subRouteParams = isSubRoute 
    ? cleanParams(params) 
    : null;
  
    const routeParams = isSubRoute 
      ? cleanParams(prevParams) 
      : cleanParams(params);
     
    const isBack = state && this.prevState && this.prevState.route === name;
     
    const State: NavigatorState = {
      route,
      subRoute, 
      subRouteParams,     
      params: routeParams,
    }
  
    if (isBack) {
      this.history.pop();
    } else {
      this.history.push({ ...State, path });
    }

    this.setState(State);
  }
 
  public subscribe=(subscriber: NavigatorSubscriber) => {
    if(!this.subscribers.includes(subscriber)){
      this.subscribers.push(subscriber);
      this.broadCastState();
      return () => this.unsubscribe(subscriber);
    }
  } 

  public unsubscribe = (subscriber: NavigatorSubscriber) => {
    if(this.subscribers.includes(subscriber)){
      this.subscribers.slice(this.subscribers.indexOf(subscriber), 1);
    }
  }

  public removeAllSubscribers = () => {
    this.subscribers = [];
  } 

  public add = (routes: NavigatorRoute[]) => {
    if(Array.isArray(routes)){
      this.routes = [...this.routes, ...routes]
      this.router.add(this.proccessRoutes(routes)); 
    }
  }

  public remove = (route: string) => {
    
  }

  private getTarget = (path: string) => path.split('.').reverse()[0];

  private checkSubroute(to: string){
    let result = false;
    const target = this.getTarget(to); 
    const callback = ({ name, subRoute } :NavigatorRoute) => { 
      if(name === target && subRoute){
        result = true;
      }
    };
    this.iterateRouteTree(this.routes, callback);
    return result;
  }

  public go = (to: string, params?: any, options: any = {}) => {
    const isSubRoute = this.checkSubroute(to);
    const prevRoute = this.state.route;
    this.router.navigate(to, { ...params, prevRoute, isSubRoute }, options);
  }
 
  public back: VoidFunction = () => {
    window.history.back();
  };

  public start = async (...args: DoneFn[]) => {
     await this.router.start(...args);
     this.broadCastState();
  }

  public stop = () => { 
     this.router.stop()
  } 
  
  public getState = () => {
    return this.state;
  }

  public getPrevState = () => {
    return this.prevState;
  }


  private validateParams = (params: NavigatorParams) => {
    if(!params){
      throw new Error('Wrong params format');
    }
    return true;
  } 

  public buildPath = (name: string, params: NavigatorParams) => {
    if(!this.validateParams(params)){
      throw new Error(ERROR_INVALID_PARAMS);
    }
    return `/${name}${buildTokenStringForPath(params)}`;
  }
   
  // public parsePath = (search: string) => {
  //   const commonParams = getUrlParams(search);
  //   return this.extractRouteAndParams(commonParams);
  // }

  // public extractRouteAndParams = (params: NavigatorParams) => {
  //   // const pesistentParams = [...this.config.persistentParams, ...NAVIGATOR_DEFAULT_PERSISTEN_PARAMS];
  //   // const persisten = Object.keys(params).filter((param) => persistenParams.includes(param));
  //   // const remainParams = params;
  //   // return {
  //   //   ...persistent,
  //   //   params: remainParams;
  //   // }
  //   return {
  //     params
  //   }
  // }
}

export const createNavigator: CreateNavigator = ({
  routes, 
  config = defaultConfig,
}) => {
  return new Navigator({ routes, config });
};