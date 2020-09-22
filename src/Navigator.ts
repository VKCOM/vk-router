import { createRouterCore, WrapperConfig as NavigatorConfig, CoreRouter, CoreSubscribeFn } from './RouterCore';  
import { getRouteData, proccessRoutes, buildFakeHistory, cleanParams } from './utils'; 
import { DoneFn } from 'router5/dist/types/base';
import { NavigatorParams, NavigatorRoute } from './types';

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
      routes: this.routes, 
      config: this.config
    }); 

    this.router.subscribe(this.syncNavigatorStateWithCore); 
    this.router.start();

    const initState = this.router.matchUrl(window.location.href); 

    if (initState) { 
      const { name: route, params } = initState;
      this.history = [{ route: name, subRoute: null, params }];
      
      this.setState({
          route,
          go: this.go,
          back: this.back,
          config,
          params,
          navigator: this,
      });
    }  

    buildFakeHistory(this.config);
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

  private syncNavigatorStateWithCore: CoreSubscribeFn = (state) => {
    const { route: coreState, previousRoute: prevCoreState } = state; 
    const { name, params = {} } = coreState;  
    // генерируется из параметров просовываемых модулем browser в том случае если обновились на subroute
    const prevCoreStateFromUrlParams = { name: params.route, params };
    const { name: prevName, params: prevParams = {} } = prevCoreState || prevCoreStateFromUrlParams; 
    /**
     * Проверяем следующее состояние роутера
     * если следующий роут - это subroute текущего, то:
     * route =  остается тем же самым
     * subroute = устанавливается в текущее значениe
     * если предыдущий роут - тоже subrout
     * то оставляем текущий роут
     */

    const routeData = getRouteData(name, this.routes);
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
      this.history.push(State);
    }

    this.setState(State);
  }
 
  public subscribe=(subscriber: NavigatorSubscriber) => {
    if (!this.subscribers.includes(subscriber)) {
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
      this.routes = [ ...this.routes, ...routes]
      this.router.add(proccessRoutes(routes)); 
    }
  }

  public remove = (route: string) => {
    
  }

  public go = (to: string, params?: any, options: any = {}, done?: any) => {
    return this.router.go(to, params, options, done);
  }

  public navigate = (to: string, params?: any, options: any = {}, done?: any) => {
    return this.router.go(to, params, options, done);
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
}

export const createNavigator: CreateNavigator = ({
  routes, 
  config = defaultConfig,
}) => {
  return new Navigator({ routes, config });
};