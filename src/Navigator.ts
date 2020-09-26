import { createRouterCore, CoreRouter, CoreSubscribeFn } from './RouterCore';  
import { getRouteData, proccessRoutes, buildFakeHistory, cleanParams } from './utils'; 

import { 
  NavigatorRoute,
  NavigatorState, 
  NavigatorHistoryRecord,
  NavigatorSubscriber,
  NavigatorCreateOptions,
  NavigatorConfig,
  
  CreateNavigatorOptions
} from './types';


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
  public isStarted = false;

  private subscribers: NavigatorSubscriber[] = [];  
  private router: CoreRouter;

  constructor ({ routes, config }: NavigatorCreateOptions) { 
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
    const prevCoreStateFromUrlParams = { name: params.route, params };
    const { name: prevName, params: prevParams = {} } = prevCoreState || prevCoreStateFromUrlParams; 

    const routeData = getRouteData(name, this.routes);
    const prevRouteIsSubRoute = this.state.subRoute === prevName; 
    const isSubRoute = (routeData && routeData.subRoute) || !!params.subroute;
    
    const route = isSubRoute 
      ? prevRouteIsSubRoute 
        ? this.state.route 
        : prevName
      : name;

    const subRoute = isSubRoute 
      ? params.subroute 
        ? params.subroute 
        : name 
      : null;

    const routeParams = isSubRoute ? cleanParams(prevParams.routeParams) : cleanParams(params.routeParams);
    const subRouteParams = isSubRoute ? cleanParams(params) : {};

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

  public start = async (...args: any[]) => {
     await this.router.start(...args);
     this.isStarted = true;
     this.broadCastState();
  }

  public stop = () => { 
    this.isStarted = false;
    this.router.stop();
  } 
  
  public getState = () => {
    return this.state;
  }

  public getPrevState = () => {
    return this.prevState;
  }
}


export type CreateNavigator = (
  options: CreateNavigatorOptions
) => Navigator;

export const createNavigator: CreateNavigator = ({
  routes, 
  config = defaultConfig,
}) => {
  return new Navigator({ routes, config });
};