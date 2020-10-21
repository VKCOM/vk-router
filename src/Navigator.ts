import { createRoutesTree } from "./tree/Tree";
import {
  buildQueryParams,
  getQueryParams,
  urlToPath,
  isChildRoute,
  deepEqual,
} from "./utils";
import {
  NavigatorRoute,
  NavigatorState,
  NavigatorHistoryRecord,
  NavigatorSubscriber,
  NavigatorConfig,
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
import { NavigatorDone } from ".";

const defaultConfig: NavigatorConfig = {
  defaultRoute: "default",
  base: "",
  subRouteKey: "subRoute",
  routeKey: "route",
};

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
  private removeLinkPressListener: VoidFunction;

  constructor(routes?: NavigatorRoute[], config?: NavigatorConfig) {
    this.routes = routes || [];
    this.config = { ...defaultConfig, ...config };

    this.errorLogger = this.config.errorLogger
      ? this.config.errorLogger
      : this.errorLogger;

    this.tree = createRoutesTree(this.routes, {
      errorLogger: this.errorLogger,
      useAdapter: this.config.useAdapter,
    });


//    console.log('TREE::', this.tree);

    this.initialize();
    // this.buildHistory();
  }

  private initialize = () => {
    let firstRouteName = (this.routes[0] || {}).name;
    const routeName = this.config.defaultRoute || firstRouteName;
    this.defaultState = {
      route: routeName,
      subroute: null,
      params: {
        [routeName]: {}
      },
    };

    const initState = this.buildState(browser.getLocation(this.config));
    this.setState({
      ...initState,
      history: this.history,
    });
  };

  private adapter = (state: NavigatorState) => {
    return {
      ...state,
      name: state.route,
      subroute: state.subroute
    };
  };

  private buildHistory = () => {
    const state = this.getState();
    let routeStr = "";
    const segments = state.route.includes(".")
      ? state.route.split(".")
      : [state.route];
    const routeSegments = segments.map((segment: string, idx: number) => {
      routeStr += idx !== 0 ? `.${segment}` : segment;
      return routeStr;
    });

    const routeEntries: NavigatorState[] = routeSegments.map(
      (routeName: string) => ({
        route: routeName,
        params: state.params[routeName],
      })
    );

    if (state.subroute) {
      routeEntries.push(state);
    }
    this.history = [...routeEntries];
    routeEntries.forEach((state: NavigatorState, idx: number) =>
      this.updateUrl(state, { replace: !idx })
    );
    // console.log('history', this.history);
  };

  private onPopState = (event: PopStateEvent) => {
    const pointer = event.state.counter;
    const nextState = this.history[pointer];
    this.replaceState(nextState);
  };

  private broadCastState = () => {
    const toState = this.config.useAdapter
      ? this.adapter(this.getState())
      : this.getState();
    const fromState = this.config.useAdapter
      ? this.adapter(this.getPrevState())
      : this.getPrevState();
    this.subscribers.forEach((subscriber: NavigatorSubscriber) =>
      subscriber({
        toState,
        fromState,
        route: toState,
        previousRoute: fromState,
      })
    );
  };

  private done = (options?: Record<string, any>) => {
    if (options.redirect) {
      this.go(options.redirect.name, {}, { replace: true });
    }
  };

  private replaceState = (state: NavigatorState) => {
    const prevState = { ...this.state };
    const nextState = { ...state };
    if (!deepEqual(prevState, nextState)) {
      const handlerCanActivate = this.routeHandlerCollection[nextState.route];
      // handlerCanActivateSubroute = this.routeHandlerCollection[nextState.subroute];
      this.state = nextState;
      this.prevState = prevState;
      if (typeof handlerCanActivate === "function") {
        handlerCanActivate(nextState, prevState, this.done);
      }
    }
    this.broadCastState();
  };

  private setState = (state: Partial<NavigatorState>) => {
    const prevState = { ...this.state };
    const nextState = { ...this.state, ...state };

    if (!deepEqual(prevState, nextState)) {
      const handlerCanActivate = this.routeHandlerCollection[nextState.route];
      // handlerCanActivateSubroute = this.routeHandlerCollection[nextState.subroute];
      this.state = nextState;
      this.prevState = prevState;
      if (typeof handlerCanActivate === "function") {
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
      this.errorLogger(ERROR_TREE_NO_ROUTE);
    }
  };

  // TODO: remove method
  public remove = (routeName: string) => {
    this.tree.remove(routeName);
  };

  public buildUrl = (
    routeName: string,
    params: NavigatorParams = {}
  ): string => {
    const { newState: state } = this.makeState(routeName, params);
    const buildedSearch = buildQueryParams(state);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    const url = `${window.location.origin}${this.config.base}${search}`;
    // console.log(url);
    return url;
  };

  public buildPath = (
    routeName: string,
    params: NavigatorParams = {}
  ): string => {
    const { newState: state } = this.makeState(routeName, params);
    const buildedSearch = buildQueryParams(state);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    return `${this.config.base}${search}`;
  };

  private makeState = (
    routeName: string,
    routeParams: NavigatorParams = {},
  ) => {
    const prevState = this.getState();
    const routeNodeData = this.tree.getRouteNode(routeName); 
    const { routePath, routeNode } = routeNodeData || {};
    const { data: routeData } = routeNode || { data: null };
    const subRouteKey = this.config.subRouteKey;
    
    let params: NavigatorParams = {
      [routeName]: routeParams || {},
    };
 
    if (routeNode?.parent?.name) {
      params = {
        [routeNode.parent.name]: prevState.params[routeNode.parent.name] || {},
        [routeName]: routeParams || {}
      }
    }

    let newState: NavigatorState = {
      route: routePath,
      subroute: null,
      params,
    };

    if (routeNode?.data?.[subRouteKey]) {
      newState = {
        route: prevState.route,
        params: {
          ...prevState.params,
          [routeName]: routeParams || { [routeName] : {}},
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
    done?: NavigatorDone
  ) => {
    const { newState, routeData } = this.makeState(
      routeName,
      routeParams,
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

    if (routeData && routeData.updateUrl !== false) {
      this.updateUrl(newState, {});
    } else {
      // fake enter for subroute page
      this.updateUrl(prevState, { fakeEntry: true });
    }

    if (done) {
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
    const location = window.location.href.split('?')[0];
    const url = `${location}${this.config.base}${search}`;

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

    this.removeLinkPressListener = browser.addLinkInterceptorListener(
      this,
      this.config
    );

    const initState = this.getState();

    if (initState && initState.route) {
      const routeName = initState.subroute || initState.route;
      const params = initState.params[routeName];
      this.go(routeName, params, { firstLoad: true });
    } else if (startRoute) {
      this.go(startRoute, params[startRoute], options);
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
    this.removeLinkPressListener();
    this.removePopStateListener();
  };

  public getState = (withoutHistory: boolean = false) => {
    if (withoutHistory) {
      const { history, ...state } = this.state;
      return state;
    }
    return this.state;
  };

  public getPrevState = (withoutHistory: boolean = false) => {
    if (withoutHistory) {
      const { history, ...state } = this.prevState;
      return state;
    }
    return this.prevState;
  };

  public isActive = (
    routeName: string,
    routeParams: NavigatorParams = {},
    strictCompare: boolean = true,
    ignoreParams: boolean = false
    // TODO: ignoreParams: boolean = false
  ) => {
    const state = this.getState(true);
    const prevState = this.getPrevState(true);
    const { newState: compareState } =
      this.makeState(routeName, routeParams) || {};

    const areSame = deepEqual(state, compareState);
    const onSubRoute =
      state.route === prevState.route && state.subroute === routeName;

    let res = false;
    
    if (!strictCompare) {
      const isChildOfRoute = routeName.includes(state.route);
      if (isChildOfRoute) {
        const areSame = deepEqual(state.params[state.route], compareState.params[compareState.route], false);
        return areSame; 
      }
     
      res = state.route === routeName || state.subroute === routeName;
    }

    res = areSame || onSubRoute;
    return res;
  };

  public canActivate = (
    routeName: string,
    routerHandler: NavigatorRouteHandler
  ) => {
    this.routeHandlerCollection[routeName] = routerHandler;
  };
}

export type CreateNavigator = (
  routes?: NavigatorRoute[],
  config?: NavigatorConfig
) => Navigator;

export const createNavigator: CreateNavigator = (
  routes,
  config = defaultConfig
) => {
  return new Navigator(routes, config);
};
