import { createRoutesTree } from './tree/Tree';
import {
  buildFakeHistory, 
  // buildUrlParams, 
  // getUrlParams,

  buildQueryParams,
  getQueryParams, 

  urlToPath,
} from './utils';
import { 
  NavigatorRoute,
  NavigatorState, 
  NavigatorHistoryRecord,
  NavigatorSubscriber,
  NavigatorCreateOptions,
  NavigatorConfig,
  
  CreateNavigatorOptions, NavigatorOptions, NavigatorParams
} from './types'; 

import { ERROR_NO_ROUTES, ERROR_HAS_TO_BE_ROUTE, ERROR_TREE_NO_ROUTE } from './constants';
import browser from './browser';
import TreeRoutes from './tree/Tree';

interface NavigatorRouteProperties {
  [key:string]: any
}

const defaultConfig: NavigatorConfig = { 
  defaultRoute: '/',
  base: '',
  useHash: false, 
  useQueryNavigation: true,
  subRouteKey: 'subRoute',
  routeKey: 'route',
};

/**
 *  class Navigator
 */
export class Navigator {
  public state: NavigatorState;
  public prevState: NavigatorState;
  public defaultState: NavigatorState;
  public history: NavigatorHistoryRecord[] = [];
  public routes: NavigatorRoute[] = [];
  public routeProperties: NavigatorRouteProperties = {};
  public config: NavigatorConfig = defaultConfig;
  public isStarted = false;

  public tree: TreeRoutes;

  private subscribers: NavigatorSubscriber[] = [];   

  private removePopStateListener: VoidFunction;

  constructor ({ routes, config }: NavigatorCreateOptions) { 
    this.routes = routes;  
    this.config = { ...defaultConfig, ...config };

    this.tree = createRoutesTree(this.routes); 

    let firstRouteName = (this.routes[0] || {}).name; 

    this.defaultState = {
      route: this.config.defaultRoute || firstRouteName,
      subroute: null,
      params: {
        route: {},
        subroute: {},
      },
    };

    const initState = this.buildState(browser.getLocation(this.config)); 
    console.log('initState', initState);
    this.setState({  
      ...initState,
      history: this.history,
      config,
      go: this.go,
      back: this.back,
      navigator: this,
    });  
   
    console.log('this', this);
    buildFakeHistory(this.config, this.routes);
  } 

  private statesAreEqual = (stateA: NavigatorState, stateB: NavigatorState) => 
    stateA && stateB 
    && stateA.route === stateB.route 
    && stateA.subroute === stateB.subroute;

  private onPopState = (event: PopStateEvent) => {
    const historyPrevState = this.history[this.history.length - 1];
    const prevState = this.getPrevState();
    const state = this.getState();
    const isBack = this.statesAreEqual(prevState, historyPrevState); 
    const nextState = isBack ? prevState : state;
    if(isBack) {
      this.history.pop();
    } else {
      this.history.push(nextState); 
    }
    
    this.setState(prevState);
    console.log('onPopState', this.history, nextState);
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

  private buildState = (url: string) => {
    const path = urlToPath(url, this.config); 
    const { route, subroute, params = {}} = getQueryParams(path);
    const RouteNode = this.tree.getRouteNode(route);
    const SubRouteNode = this.tree.getRouteNode(subroute);
    let State: NavigatorState = this.defaultState;

    if (RouteNode) {
      State = { route, params }; 
      if (SubRouteNode) {
        State = {
          route,
          subroute,
          params
        }
      }
    }
    
    if (!State.route) {
      console.error(ERROR_HAS_TO_BE_ROUTE);
      return this.defaultState;
    }
 
    return State;
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

  public add = (routes: NavigatorRoute[] | NavigatorRoute) => {
    if (Array.isArray(routes)) {
      this.routes = [ ...this.routes, ...routes]
      routes.forEach((route: NavigatorRoute) => {
        this.tree.add(route); 
      });
    } else if(routes){
      this.tree.add(routes); 
    } else {
      throw new Error(ERROR_TREE_NO_ROUTE);
    }
  }

  // TODO: remove method
  public remove = (routeName: string) => {
    this.tree.remove(routeName);
  }

  public buildUrl = (routeName: string, params: NavigatorParams) => { 
    const state = this.makeState(routeName, params);
    const buildedSearch = buildQueryParams(state);
    const search = buildedSearch.length ? '?' + buildedSearch : '';
    return `${window.location.origin}${this.config.base}${search}`;
  }

  private makeState = (routeName: string, routeParams: NavigatorParams = {}, options: NavigatorOptions = {}) => {
    const routeNodeData = this.tree.getRouteNode(routeName);
    const { routePath, routeNode } = routeNodeData || {};
    const { data: routeData } = routeNode;
    const subRouteKey = this.config.subRouteKey;
    const prevState = this.getState();
    
    const params: NavigatorParams = {
      route: routeParams,
    }

    let newState: NavigatorState = {
      route: routePath,
      params,  
    }; 
  
    if (routeNode.data[subRouteKey]) {
      newState = {
        route: prevState.route,
        params: {
          route: prevState.params.route,
          subroute: routeParams,
        },
        subroute: routePath,
      };
    } 

    return { newState, routeData };
  }

  public go = (routeName: string, routeParams?: any, options: NavigatorOptions = {}, done?: any) => {
    if(options.firstLoad){
      debugger;
    }

    console.log('income Params', routeParams);
    const { newState, routeData } = this.makeState(routeName, routeParams, options);
    this.history.push(newState);
    this.setState(newState);
    if (routeData.updateUrl !== false) {
      this.updateUrl(newState, options);
    }

    if (typeof done === 'function') {
      done(newState);
    }
  }

  // TODO : only querynav available at the moment
  public updateUrl = (state: NavigatorState, options: NavigatorOptions, title: string = '') => {
    console.log('updateUrl', state);
    const buildedSearch = buildQueryParams(state);
    const search = buildedSearch.length ? '?' + buildedSearch : '';
    const url = `${window.location.origin}${this.config.base}${search}`; 
    
    if(options.replace){
      browser.replaceState(state, title, url);
    } else {
      browser.pushState(state, title, url);
    }
  } 

  public navigate = (to: string, params?: any, options: any = {}, done?: any) => {
    return this.go(to, params, options, done);
  }
 
  public back: VoidFunction = () => {
    window.history.back();
  };

  public start = (startRoute?: string, params?: NavigatorParams, options?: NavigatorOptions) => {
      this.isStarted = true;
      this.removePopStateListener = browser.addPopstateListener(this.onPopState, this.config);

      const initState = this.getState();
 
      if (initState && initState.route) {  
        const routeName = initState.subroute || initState.route;
        const params = initState.params.subroute || initState.params.route;
        this.go(routeName, params, { firstLoad: true });
      } else if (startRoute) {
        this.go(startRoute, params, options);
      } else {
        const { defaultRoute } = this.config;
        if (defaultRoute) {
          this.go(defaultRoute, {}, {});
        } else {
          const [startRoute] = this.routes;
          if (startRoute && startRoute.name) {
            this.go(startRoute.name, {}, {});
          } else {
            if (this.defaultState) {
              this.setState(this.defaultState);
            }
            throw new Error (ERROR_NO_ROUTES);
          }
        }
      }

      this.broadCastState();
     return this;
  }

  public stop = () => { 
    this.isStarted = false;
    this.removePopStateListener();
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