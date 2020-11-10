/** 
 * Модуль навигации - обычная машина состояний,
 * возвращает состояние подписчикам
 */
import { createRoutesTree } from "./tree/Tree";
import {
  buildQueryParams,
  getQueryParams,
  urlToPath,
  deepEqual,
  hasProperties,
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
  // ERROR_HAS_TO_BE_ROUTE,
  ERROR_TREE_NO_ROUTE,
} from "./constants";

import browser from "./browser";
import TreeRoutes from "./tree/Tree";
import { NavigatorDone } from ".";
import RouteNode from "./tree/RouteNode";

/** 
 * Объект конфигурации по умолчанию 
 */
const defaultConfig: NavigatorConfig = {
  defaultRoute: "default",
  base: "",
  subRouteKey: "subRoute",
  routeKey: "route",
};

/** 
 * Главный класс, описывающий основные методы жизненного цикла роутера
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
  }

  /** 
   * Метод жизненного цикла роутера - инициализирует начальное состояние роутера до старта
   * и задает fallback сосотяние по умолчанию, на которое можно перейти в случае ошибки.
   */
  private initialize = () => {
    const firstRouteName = (this.routes[0] || {}).name;
    const routeName = this.config.defaultRoute || firstRouteName;

    this.defaultState = {
      page: routeName,
      modal: null,
      params: {},
    };

    this.setState({
      ...this.buildState(browser.getLocation(this.config)),
      history: this.history,
    });
  };

  /** 
   * Метод жизненного цикла роутера - выполняет заполнение
   * стека истории роутера на основе начального состояния
   * в дальнейшем перемещение по истории осуществляется только по внутреннему стеку.
   */
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
    //console.log('builded history', this.history);
  };

  /** 
   * Метод обработки события popstate, обеспечивает переход по внутреннему стеку истории роутера.
   * При достижении первого вхождения дальнейшие переходы назад в браузере
   * заменяются на первое вхождение в историю через API history.replaceState
   */
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

  /** 
   * Метод жизненного цикла роутера для передачи состояния в подписчики 
   */
  private broadCastState = () => {
    const toState = this.getState();
    const fromState = this.getPrevState();

    this.subscribers.forEach((subscriber: NavigatorSubscriber) =>
      subscriber({
        toState,
        fromState,
      })
    );
  };

  /** 
   * Метод для выполнения callback функций переданных в метод go 
   */
  private done = (options?: Record<string, any>) => {
    if (options.redirect) {
      this.go(options.redirect.name, {}, { replace: true });
    }
  };

  /** 
   * Метод полностью заменяет состояние роутера на указанное в аргументе 
   */
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

  /** 
   * Метод жизненного цикла роутера - устанавливает переход в новое состояние роутера.
   * Пока выполняется синхронно.
   */
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

  /** 
   * Метод создания состояния на основе переданного URL в инициализированный роутер,
   * используется для получения начального состояния роутера
   */
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

    // if (!State.page) {
    //   this.errorLogger(ERROR_HAS_TO_BE_ROUTE);
    //   return this.defaultState;
    // }

    return State;
  };

  /**
   *  Метод подписки на обновления сосотяния роутера
   */
  public subscribe = (subscriber: NavigatorSubscriber) => {
    if (!this.subscribers.includes(subscriber)) {
      this.subscribers.push(subscriber);
      this.broadCastState();

      return () => this.unsubscribe(subscriber);
    }
  };

  /** 
   * Метод отписки от обновлений сосотяния роутера 
   */
  public unsubscribe = (subscriber: NavigatorSubscriber) => {
    if (this.subscribers.includes(subscriber)) {
      this.subscribers.slice(this.subscribers.indexOf(subscriber), 1);
    }
  };

  /** 
   * Метод удаления всех подписчиков на роутер 
   * */
  public removeAllSubscribers = () => {
    this.subscribers = [];
  };

  /** 
   * Метод добавления узлов в указанное дерево, по умолчанию  в текущее активное 
   * */
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

  /** 
   * Метод удаления узлов из указанного дерева, по умолчанию  из текущего активного 
   * */
  public remove = (routeName: string) => {
    this.tree.remove(routeName);
  };

  /** 
   * Метод создания ссылки на основе имени роута и параметров. 
   * */
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

  /** 
   * Метод создания ссылки на основе имени роута и параметров. 
   * */
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

  /** 
   * Метод получения коллекции активных узлов,
   * в порядке от корня дерева заканчивая текущим активным роутом
   * */
  private getActiveNodes = (routeName: string) => {
    const activeNodes = [];

    if (routeName) {
      const routeNode = this.tree.getRouteNode(routeName);
      const stack = [routeNode];
      while (stack.length) {
        const node = stack.shift();
        activeNodes.push(node);
        if (node.parent) {
          if (node.parent.name !== "") {
            stack.push(node.parent);
          }
        }
      }
    }
    return activeNodes.reverse();
  };

  /** 
   * Метод получения коллекции обязательных параметров для переданного узла,
   * в порядке от корня дерева заканчивая текущим активным роутом
   * */
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

  /** 
   * Метод получения коллекции активных параметров для коллекции узлов
   * */
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

  /** 
   * Утилита роутера, выполняет построение состояния роутера на основе
   * переданного имени маршрута, параметров, а так же построенного дерева маршрутов
   * */
  private makeState = (
    routeName: string,
    routeParams: NavigatorParams = {}
  ) => {
    const prevState = this.getState();

    const routeNode: RouteNode = this.tree.getRouteNode(routeName);
    const { data: routeData } = routeNode || { data: null };

    const subRouteKey = this.config.subRouteKey;

    let params: NavigatorParams = { ...routeParams };
    const activeNodes = this.getActiveNodes(routeName);
    if (routeNode?.parent?.name) {
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
    return { newState, routeData, activeNodes };
  };

  /** 
   * Основной метод навигации роутера 
   * */
  public go = (
    routeName: string,
    routeParams?: any,
    options: NavigatorOptions = {},
    done?: NavigatorDone
  ) => {
    const { newState, routeData } = this.makeState(routeName, routeParams);

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
      this.updateUrl(prevState, { fakeEntry: true });
    }

    if (done) {
      done(newState);
    }
  };

  /**  
   * Метод обновления URL браузера в зависимости от конфигурации и переданных опций 
   * */
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

  /**
   * Основной метод навигации
   * */
  public navigate = (
    to: string,
    params?: any,
    options: any = {},
    done?: any
  ) => {
    return this.go(to, params, options, done);
  };

  /**
   * Основной метод навигации назад
   * */
  public back: VoidFunction = () => {
    window.history.back();
  };

  /**
   * Метод жизненного цикла роутера, активирует роутер, выполняет метод построение истории buildHistory,
   * выполняют привязку основных обработчиков событий popstate и обработчика для перехвата нажатий на ссылки.
   * Осуществляет начальный переход на актуальное состояние роутера
   * */
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

    this.buildHistory();

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
  };

  /**  
   * Метод жизненного цикла роутера, деактивирует роутер, удаляет обработчики событий. 
   * */
  public stop = () => {
    this.isStarted = false;
    this.removeLinkPressListener();
    this.removePopStateListener();
  };

  /**  
   * Метод жизненного цикла роутера, возвращает текущее состояние роутера. 
   * */
  public getState: NavigatorGetState = (options = {}) => {
    const { withoutHistory = false } = options;
    let state = this.state;

    if (withoutHistory) {
      const { history, ...activeState } = this.state;
      state = {
        ...activeState,
      };
    }

    return state;
  };

  /**  
   * Метод жизненного цикла роутера, возвращает предыдущее состояние роутера. 
   * */
  public getPrevState: NavigatorGetState = (options = {}) => {
    if (options.withoutHistory) {
      const { history, ...state } = this.prevState;
      return state;
    }
    return this.prevState;
  };

  /**  
   * Утилита роутера, возвращает булево значение
   * является ли переданный роут с параметрами активными в данном состоянии роутера. 
   * */
  public isActive = (
    routeName: string,
    routeParams?: NavigatorParams,
    strictCompare: boolean = true,
    ignoreParams: boolean = false // в режиме query navigation  игнорируются все queryparams кроме обязательных
  ) => {
    const state = this.getState({ withoutHistory: true });
    const activeStateParams = state.params;
    const activeRouteNodes = this.getActiveNodes(state.page);
    const acitveModalNodes = this.getActiveNodes(state.modal);
    const activeNodes = activeRouteNodes.concat(acitveModalNodes);
    const activeNode = activeNodes.find((el) => el.routePath === routeName);
    const isActiveNode = !!activeNode;

    const hasParamsInState = hasProperties(activeStateParams, routeParams);

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

  /** 
   * Метод жизненного цикла роутера, добавляет во внтруеннюю коллекцию обработчики  
   * */
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

/** 
 * Фабрика для создания экземпляра роутера 
 * */
export const createNavigator: CreateNavigator = (
  routes,
  config = defaultConfig
) => {
  return new Navigator(routes, config);
};
