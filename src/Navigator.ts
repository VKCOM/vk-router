import { createRoutesTree } from "./tree/Tree";
import {
  buildQueryParams,
  getQueryParams,
  urlToPath,
  deepEqual,
} from './utils';
import {
  NavigatorRoute,
  NavigatorState,
  NavigatorHistoryRecord,
  NavigatorSubscriber,
  NavigatorCreateOptions,
  NavigatorConfig,
  CreateNavigatorOptions,
  NavigatorOptions,
  NavigatorParams,
  NavigatorRouteHandler,
  NavigatorRouteHandlerCollection,
  NavigatorErrorLogger,
} from "./types";

import {
  ERROR_NO_ROUTES,
  ERROR_HAS_TO_BE_ROUTE,
  ERROR_TREE_NO_ROUTE,
} from "./constants";
import browser from "./browser";
import TreeRoutes from "./tree/Tree";

const defaultConfig: NavigatorConfig = {
  defaultRoute: "/",
  base: "",
  subRouteKey: "subRoute",
  routeKey: "route",
};

/**
 * TODO:
 *   - required parameters per route
 *   - canActivate Hook
 *   - canDeactivate Hook
 *   - transition Hook
 */
export class Navigator {
  public state: NavigatorState;
  public prevState: NavigatorState;
  public defaultState: NavigatorState;
  public history: NavigatorHistoryRecord[] = [];
  public routes: NavigatorRoute[] = [];
  private subscribers: NavigatorSubscriber[] = [];
  private routeHandlerCollection: NavigatorRouteHandlerCollection = {};
  public config: NavigatorConfig = defaultConfig;

  public isStarted = false;

  private errorLogger: NavigatorErrorLogger = (err) => console.log(err);
  
  public tree: TreeRoutes;


  private removePopStateListener: VoidFunction;

  constructor({ routes, config }: NavigatorCreateOptions) {
    this.routes = routes || [];
    this.config = { ...defaultConfig, ...config };

    this.errorLogger = this.config.errorLogger
      ? this.config.errorLogger
      : this.errorLogger;

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
    this.setState({
      ...initState,
      history: this.history,
    });

    this.buildHistory();
  }

  private buildHistory = () => {
    const state = this.getState();
    let routeStr = '';
    const segments = state.route.includes('.') ? state.route.split('.') : [state.route];
    const routeSegments = segments.map((segment: string, idx: number) => {
      routeStr+= idx !== 0 ? `.${segment}`: segment;
      return routeStr;
    });
    
    const routeEntries: NavigatorState[] = routeSegments.map((routeName: string) => ({ 
        route: routeName, 
        params: { route: state.params.route }
      }));

    if (state.subroute) {
      routeEntries.push(state);
    }
    this.history = [ ...routeEntries];
    routeEntries.forEach((state: NavigatorState, idx: number) => this.updateUrl(state, { replace: !idx }));
  };

  private onPopState = (event: PopStateEvent) => {
    const pointer = event.state.counter;
    const nextState = this.history[pointer];
    this.setState(nextState);
  };

  private broadCastState = () => {
    const toState = this.getState();
    const fromState = this.getPrevState();
    this.subscribers.forEach((subscriber: NavigatorSubscriber) =>
      subscriber({ toState, fromState })
    );
  };

  private done = (options?: Record<string, any>) => {
    if (options.redirect) {
      this.go(options.redirect.name, {}, { replace: true });
    }
  };

  private setState = (state: Partial<NavigatorState>) => {
    const prevState = { ...this.state };
    const nextState = { ...this.state, ...state };
  
    if (!deepEqual(prevState, nextState)) {
      const handlerCanActivate = this.routeHandlerCollection[nextState.route];
      // handlerCanActivateSubroute = this.routeHandlerCollection[nextState.subroute];
      this.state = nextState;
      this.prevState = prevState;
      if (typeof handlerCanActivate === 'function') { 
        handlerCanActivate(nextState, prevState, this.done);
      }  
    }
    this.broadCastState();
  };

  private buildState = (url: string) => {
    const path = urlToPath(url, this.config);
    const { route, subroute = null, params = {} } = getQueryParams(path);
    const RouteNode = this.tree.getRouteNode(route);
    let State: NavigatorState = this.defaultState;

    if (RouteNode) {
      State = {
        route,
        subroute,
        params,
      };
    }

    if (!State.route) {
      this.errorLogger(ERROR_HAS_TO_BE_ROUTE);
      return this.defaultState;
    }

    return State;
  };

  public subscribe = (subscriber: NavigatorSubscriber) => {
    if (!this.subscribers.includes(subscriber)) {
      this.subscribers.push(subscriber);
      this.broadCastState();

      return () => this.unsubscribe(subscriber);
    }
  };

  public unsubscribe = (subscriber: NavigatorSubscriber) => {
    if (this.subscribers.includes(subscriber)) {
      this.subscribers.slice(this.subscribers.indexOf(subscriber), 1);
    }
  };

  public removeAllSubscribers = () => {
    this.subscribers = [];
  };

  public add = (routes: NavigatorRoute[] | NavigatorRoute) => {
    if (Array.isArray(routes)) {
      this.routes = [...this.routes, ...routes];
      routes.forEach((route: NavigatorRoute) => {
        this.tree.add(route);
      });
    } else if (routes) {
      this.tree.add(routes);
    } else {
      throw new Error(ERROR_TREE_NO_ROUTE);
    }
  };

  // TODO: remove method
  public remove = (routeName: string) => {
    this.tree.remove(routeName);
  };

  public buildUrl = (routeName: string, params: NavigatorParams) => {
    const state = this.makeState(routeName, params);
    const buildedSearch = buildQueryParams(state);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    return `${window.location.origin}${this.config.base}${search}`;
  };

  private makeState = (
    routeName: string,
    routeParams: NavigatorParams = {},
    options: NavigatorOptions = {}
  ) => {
    const routeNodeData = this.tree.getRouteNode(routeName);
    const { routePath, routeNode } = routeNodeData || {};
    const { data: routeData } = routeNode;
    const subRouteKey = this.config.subRouteKey;
    const prevState = this.getState();

    const params: NavigatorParams = {
      route: routeParams,
    };

    let newState: NavigatorState = {
      route: routePath,
      subroute: null,
      params,
    };

    if (routeNode.data[subRouteKey]) {
      newState = {
        route: prevState.route,
        params: {
          route: prevState.params.route || {},
          subroute: routeParams || {},
        },
        subroute: routePath,
      };
    }

    return { newState, routeData };
  };

  public go = (
    routeName: string,
    routeParams?: any,
    options: NavigatorOptions = {},
    done?: any
  ) => {
    const { newState, routeData } = this.makeState(
      routeName,
      routeParams,
      options
    );
    const prevHistoryState = this.history[this.history.length - 2];
    const isBack = deepEqual(prevHistoryState, newState);

    if (isBack) { 
      this.history.pop();
    } else {
      this.history.push(newState);
    }

    
    this.setState(newState);
    const prevState = this.getPrevState();

    if (routeData.updateUrl !== false) {
      this.updateUrl(newState, {});
    } else {
      // fake enter for subroute page
      this.updateUrl(prevState, { fakeEntry: true });
    }

    if (typeof done === "function") {
      done(newState);
    }
  };

  // TODO : only querynav available at the moment
  public updateUrl = (
    state: NavigatorState,
    options: NavigatorOptions = {},
    title: string = ""
  ) => {
    const stateToHistory = { ...state, counter: this.history.length - 1 };
    if (options.fakeEntry) {
      const currentUrl = browser.getLocation(this.config);
      browser.pushState(stateToHistory, title, currentUrl);
      return;
    }

    const buildedSearch = buildQueryParams(state);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    const url = `${window.location.origin}${this.config.base}${search}`;

    if (options.replace) {
      browser.replaceState(stateToHistory, title, url);
    } else {
      browser.pushState(stateToHistory, title, url);
    }
  };

  public navigate = (
    to: string,
    params?: any,
    options: any = {},
    done?: any
  ) => {
    return this.go(to, params, options, done);
  };

  public back: VoidFunction = () => {
    window.history.back();
  };

  public start = (
    startRoute?: string,
    params?: NavigatorParams,
    options?: NavigatorOptions
  ) => {
    this.isStarted = true;
    this.removePopStateListener = browser.addPopstateListener(
      this.onPopState,
      this.config
    );

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
        this.go(defaultRoute);
      } else {
        const [startRoute] = this.routes;
        if (startRoute && startRoute.name) {
          this.go(startRoute.name);
        } else {
          if (this.defaultState) {
            this.setState(this.defaultState);
          }
          this.errorLogger(ERROR_NO_ROUTES);
        }
      }
    }

    this.broadCastState();
  };

  public stop = () => {
    this.isStarted = false;
    this.removePopStateListener();
  };

  public getState = () => {
    return this.state;
  };

  public getPrevState = () => {
    return this.prevState;
  };

  public isActive = (
    routeName: string,
    routeParams: NavigatorParams = {},
    strictCompare: boolean = true,
    // TODO: ignoreParams: boolean = false
  ) => {
    const { history, ...state } = this.getState();
    const { newState: compareState } = this.makeState(routeName, routeParams) || {};
    const areSame = deepEqual(state, compareState);
    let res = false;
    if (!strictCompare) {
      res = state.route === routeName || state.subroute === routeName;
    }
    res = areSame;
    console.log(state, compareState)
    return res;
  }; 
  // router5 like interfaces

  public canActivate = (
    routeName: string,
    routerHandler: NavigatorRouteHandler
  ) => {
    this.routeHandlerCollection[routeName] = routerHandler;
  };

  public canDeactivate = () => {};
}

export type CreateNavigator = (options: CreateNavigatorOptions) => Navigator;

export const createNavigator: CreateNavigator = ({
  routes,
  config = defaultConfig,
}) => {
  return new Navigator({ routes, config });
};
