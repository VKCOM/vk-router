import { createRoutesTree } from "./tree/Tree";
import {
  buildQueryParams,
  getQueryParams,
  urlToPath,
  deepEqual,
} from "./utils";
import {
  NavigatorRoute,
  NavigatorState,
  NavigatorGetState,
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
import RouteNode from "./tree/RouteNode";

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

    this.initialize();
    this.buildHistory();
  }

  private initialize = () => {
    let firstRouteName = (this.routes[0] || {}).name;
    const routeName = this.config.defaultRoute || firstRouteName;
    this.defaultState = {
      page: routeName,
      modal: null,
      params: {},
    };

    const initState = this.buildState(browser.getLocation(this.config));
    this.setState({
      ...initState,
      history: this.history,
    });
  };

  private adapter = (state: NavigatorState) => state;

  // build entries to history object and gather params from url
  private buildHistory = () => {
    const { page, params } = this.getState();
    const stack = [...this.getActiveNodes(page)];

    while (stack.length) {
      const node = stack.shift();

      const state: NavigatorState = {
        page: node.routePath,
        modal: null,
        params: this.getActiveParams([node], params),
      };

      this.history.push(state);
      this.updateUrl(state);
    }
  };

  private onPopState = (event: PopStateEvent) => {
    const pointer = event.state?.counter;
    const nextState = this.history[pointer];
    const [rootState] = this.history;

    if (pointer !== undefined) {
      this.replaceState(nextState);
    } else {
      this.replaceState(rootState);
      this.updateUrl(rootState, { replace: true });
    }
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
      const handlerCanActivate = this.routeHandlerCollection[nextState.page];
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
      const handlerCanActivate = this.routeHandlerCollection[nextState.page];
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
    const { p: page, m: modal = null, ...params } = getQueryParams(path);
    const RouteNode = this.tree.getRouteNode(page);

    let State: NavigatorState = this.defaultState;

    if (RouteNode) {
      State = {
        page,
        modal,
        params: params || {},
      };
    }

    if (!State.page) {
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
    const { page, modal, params: stateParams } = state;
    const stateToUrl = {
      p: page,
      m: modal,
      ...stateParams,
    };
    const buildedSearch = buildQueryParams(stateToUrl);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    return `${this.config.base}${search}`;
  };

  public buildPath = (
    routeName: string,
    params: NavigatorParams = {}
  ): string => {
    const { newState: state } = this.makeState(routeName, params);
    const { page, modal, params: stateParams } = state;
    const stateToUrl = {
      p: page,
      m: modal,
      ...stateParams,
    };
    const buildedSearch = buildQueryParams(stateToUrl);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    return `${this.config.base}${search}`;
  };

  private getActiveNodes = (routeName: string) => {
    const activeNodes = [];
    if (routeName && routeName.includes(".")) {
      let path = "";
      const segments = routeName.split(".");
      segments.forEach((segment: string, idx: number) => {
        path += idx ? `.${segment}` : segment;

        const routeNode = this.tree.getRouteNode(path);
        if (routeNode) {
          activeNodes.push(routeNode);
        }
      });
    } else if (routeName) {
      const routeNode = this.tree.getRouteNode(routeName);
      if (routeNode) {
        activeNodes.push(routeNode);
      }
    }

    return activeNodes;
  };

  private getRequiredParams = (node: RouteNode) => {
    let params: string[] = [];
    const stack = [node];

    while (stack.length) {
      const node = stack.shift();
      if (node?.params) {
        params = params.concat(node?.params);
        if (node.parent) {
          stack.push(node.parent);
        }
      }
    }

    return params;
  };

  private getActiveParams = (
    activeNodes: RouteNode[],
    paramsPool: Record<string, any>
  ) => {
    const activeParams: Record<string, any> = {};
    const stack = [...activeNodes];
    while (stack.length) {
      const node = stack.shift();
      const keys: string[] = this.getRequiredParams(node);
      for (const key of keys) {
        activeParams[key] = paramsPool[key];
      }
    }

    return activeParams;
  };

  private makeState = (
    routeName: string,
    routeParams: NavigatorParams = {},
    fromGo?: boolean
  ) => {
    const prevState = this.getState();

    const routeNode: RouteNode = this.tree.getRouteNode(routeName);
    const { data: routeData } = routeNode || { data: null };

    const subRouteKey = this.config.subRouteKey;

    let params: NavigatorParams = { ...routeParams };

    if (routeNode?.parent?.name) {
      const activeNodes = this.getActiveNodes(routeName);
      const activeParams: Record<string, any> = this.getActiveParams(
        activeNodes,
        prevState.params
      );

      params = {
        ...activeParams,
        ...routeParams,
      };
    }

    let newState: NavigatorState = {
      page: routeName,
      modal: null,
      params,
    };

    if (routeNode?.data?.[subRouteKey]) {
      newState = {
        page: prevState.page,
        params: {
          ...prevState.params,
          ...routeParams,
        },
        modal: routeNode.routePath,
      };
    }

    // if (fromGo) {
    //   console.log('----->', routeName, routeParams, newState, routePath, routeData);
    // }
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
      true
    );

    const prevHistoryState = this.history[this.history.length - 2];
    const isBack = deepEqual(prevHistoryState, newState);

    if (options.firstLoad) {
      const beforeHistoryState = this.history[this.history.length - 1];
      const sameState = deepEqual(beforeHistoryState, newState);
      if (sameState) return;
    }

    if (isBack) {
      this.history.pop();
    } else {
      this.history.push(newState);
    }

    this.setState(newState);
    const prevState = this.getPrevState();

    if (routeData && routeData.updateUrl !== false) {
      this.updateUrl(newState, options);
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
    const stateToHistory = {
      ...state,
      ...state.params,
      counter: this.history.length - 1,
    };

    if (options.fakeEntry) {
      const currentUrl = browser.getLocation(this.config);
      browser.pushState(stateToHistory, title, currentUrl);
      return;
    }

    const stateToUrl: Record<string, any> = {
      p: state.page,
      ...state.params,
    };

    if (state.modal) {
      stateToUrl.m = state.modal;
    }

    const buildedSearch = buildQueryParams(stateToUrl);
    const search = buildedSearch.length ? "?" + buildedSearch : "";
    const location = window.location.href.split("?")[0];
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

    this.removeLinkPressListener = browser.addLinkInterceptorListener.call(
      this
    );

    const initState = this.getState();

    if (initState && initState.page) {
      const routeName = initState.modal || initState.page;
      const params = initState.params;

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
    this.removeLinkPressListener();
    this.removePopStateListener();
  };

  public getState: NavigatorGetState = (options = {}) => {
    const { withoutHistory = false } = options;

    let State = { ...this.state };

    if (withoutHistory) {
      const { history, ...state } = this.state;
      State = {
        ...state,
      };
    }

    return State;
  };

  public getPrevState: NavigatorGetState = (options = {}) => {
    if (options.withoutHistory) {
      const { history, ...state } = this.prevState;
      return state;
    }
    return this.prevState;
  };

  public isActive = (
    routeName: string,
    routeParams?: NavigatorParams,
    strictCompare: boolean = true,
    ignoreParams: boolean = false
  ) => {
    const state = this.getState({ withoutHistory: true });
    const activeRouteNodes = this.getActiveNodes(state.page);
    const acitveModalNodes = this.getActiveNodes(state.modal);
    const activeNodes = activeRouteNodes.concat(acitveModalNodes);
    const isActiveNode = !!activeNodes.find((el) => el.routePath === routeName);
    const hasParamsInState = deepEqual(state.params, routeParams);

    const { newState: compareState } =
      this.makeState(routeName, routeParams) || {};

    const areSameStates = deepEqual(state, compareState);

    if (strictCompare) {
      return areSameStates;
    } else if (routeParams && Object.keys(routeParams).length) {
      return areSameStates || (isActiveNode && hasParamsInState);
    }

    return areSameStates || isActiveNode;
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
