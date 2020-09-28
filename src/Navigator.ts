import { createRouterCore, CoreRouter, CoreSubscribeFn } from './RouterCore';  
import { getRouteData, proccessRoutes, buildFakeHistory, getRouteParams } from './utils'; 
import { restoreParams } from './plugin/utils';
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
          config,
          params,
          go: this.go,
          back: this.back,
          navigator: this,
      });
    }  

    buildFakeHistory(this.config, this.routes);
  } 

  private broadCastState = () => {
     const toState = this.getState();
     const fromState = this.getPrevState();
     this.subscribers.forEach((subscriber: NavigatorSubscriber) => subscriber({ toState, fromState }));
  }
  
  private setState = (state: Partial<NavigatorState>) => {
    this.prevState = { ...this.state };
    this.state = { ...this.state, ...state };
    this.broadCastState();
  }

  private syncNavigatorStateWithCore: CoreSubscribeFn = (state) => {
    const { 
      route: coreState, 
      previousRoute: prevCoreState } = state; 
    const { name, params = {} } = coreState;  

    const prevCoreStateFromUrlParams = { name: params.route, params };

    const { name: prevName, params: prevParams = {} } = prevCoreState || prevCoreStateFromUrlParams; 
    
    const routeData = getRouteData(name, this.routes);
    const isSubRoute = (routeData && routeData.subRoute) || !!params.subroute;
    const isSubRoutePrevRoute = this.state.subRoute === prevName; 
    
    const route = isSubRoute 
      ? isSubRoutePrevRoute 
        ? this.state.route 
        : prevName
      : name;

    const subRoute = isSubRoute 
      ? params.subroute 
        ? params.subroute 
        : name 
      : null;

    const restoredPrevParams = restoreParams(prevParams);
    const restoredParams = restoreParams(params);
    const cleanedPrevRouteParams = getRouteParams(restoredPrevParams).route || {};
    const cleanedRouteParams = getRouteParams(restoredParams).route || {};
    const cleanedSubRouteParams = getRouteParams(restoredParams).subroute || {};

    const routeParams = isSubRoute ? cleanedPrevRouteParams : cleanedRouteParams;
    const subRouteParams = cleanedSubRouteParams;

    const isBack = state && this.prevState && this.prevState.route === name;
     
    const prevHistoryState = this.history[this.history.length - 1];
    const State: NavigatorState = {
      route,
      subRoute, 
      subRouteParams,     
      params: routeParams,
    };
  
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
    // TODO: implement remove method
    console.log('route to remove', route);
  }

  public go = (to: string, params?: any, options: any = {}, done?: any) => {
    return this.router.go(to, params, options, done);
  }

  public navigate = (to: string, params?: any, options: any = {}, done?: any) => {
    return this.router.go(to, params, options, done);
  }
 
  public back: VoidFunction = () => {
    const { route, subRoute, subRouteParams, params } = this.getPrevState();
    this.router.goBack();
  };

  public start = (...args: any[]) => {
     Promise.resolve(this.router.start(...args))
     .then(() => {
      this.isStarted = true;
      this.broadCastState();
     })

     return this;
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