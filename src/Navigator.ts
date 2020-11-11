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
  cleanFields,
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
  NavigatorDone,
} from "./types";

import {
  ERROR_NO_ROUTES,
  // ERROR_HAS_TO_BE_ROUTE,
  ERROR_TREE_DOESNT_EXIST,
  ERROR_TREE_ALREADY_EXIST,
  ERROR_TREE_NO_ROUTE,
  ERROR_ALREADY_SUBSCRIBED,
} from "./constants";

import browser from "./browser";
import TreeRoutes from "./tree/Tree";
import RouteNode from "./tree/RouteNode";

/**
 * Объект конфигурации по умолчанию
 */
const defaultConfig: NavigatorConfig = {
  defaultRoute: "default",
  base: "",
  subRouteKey: "subRoute",
  routeKey: "route",
  rootPage: undefined,
  preserveHash: false,
  preservePath: true,
};

/**
 * Главный класс, описывающий основные методы жизненного цикла роутера
 */
export class Navigator {
  /**
   * Основное состояние роутера, отдаваемое наружу
   */
  public state: NavigatorState;
  /**
   * Предыдущее состояние роутера, отдаваемое наружу
   */
  public prevState: NavigatorState;
  /**
   * fallback состояние для перехода на него в случае ошибок
   */
  public defaultState: NavigatorState;
  /**
   * Внутренний стек навигации
   */
  public history: NavigatorHistoryRecord[] = [];
  /**
   * Ссылка на переданные в конфиге коллекции маршрутов
   */
  public routes: NavigatorRoute[] = [];
  /**
   * Коллекция подписчиков на роутер
   */
  private subscribers: NavigatorSubscriber[] = [];
  /**
   * Коллекция хендлеров исполняемых при переходе на соответствующий роут
   */
  private routeHandlerCollection: NavigatorRouteHandlerCollection = {};
  /**
   * Текущий объект конфигурации роутера
   */
  public config: NavigatorConfig = defaultConfig;
  /**
   * Состояние активации роутера
   */
  public isStarted = false;
  /**
   * Логгер ошибок роутера - используется по всему модулю
   */
  private errorLogger: NavigatorErrorLogger = (err) => console.log(err);
  /**
   * Коллекция деревьев навигации, может ббыть использована для смены заданной навигации
   * через метод setActiveTree
   */
  public trees: Record<string, TreeRoutes> = {};
  /**
   * Текущее активное дерево
   */
  private tree: TreeRoutes;
  
  private removePopStateListener: VoidFunction;
  private removeLinkPressListener: VoidFunction;

  constructor(routes?: NavigatorRoute[], config?: NavigatorConfig) {
    this.routes = routes || [];
    this.config = { ...defaultConfig, ...config };
    /**
     * Установка логгера ошибок из объекта конфигурации
     */
    this.errorLogger = this.config.errorLogger
      ? this.config.errorLogger
      : this.errorLogger;
    /**
     * Создание основного дерева навигации
     */
    this.tree = createRoutesTree(this.routes, {
      errorLogger: this.errorLogger,
    });
    /**
     * Выполнение этапа инициализации начального состояния роутера
     */
    this.initialize();
  }

  /**
   * Метод жизненного цикла роутера - инициализирует начальное состояние роутера до старта
   * и задает fallback сосотяние по умолчанию, на которое можно перейти в случае ошибки.
   */
  private initialize = () => {
    const firstRouteName = (this.routes[0] || {}).name;
    const page = this.config.defaultRoute || firstRouteName;

    this.defaultState = {
      page,
      modal: null,
      params: {},
    };
    /**
     * собираем начальное состояние из URL
     */
    const initState = this.buildState(browser.getLocation(this.config));

    this.setState(initState);
  };

  /**
   * Метод получения внутреннего стека истории роутера
   */
  public getHistory() {
    const historyStack = [...this.history];
    return historyStack;
  }

  /**
   * Метод жизненного цикла роутера - выполняет заполнение
   * стека истории роутера на основе начального состояния
   * в дальнейшем перемещение по истории осуществляется только по внутреннему стеку.
   */
  private buildHistory = () => {
    const { page, params } = this.getState();
    const { rootPage } = this.config;
    /**
     * Вхождение для rootPage
     */
    if (page !== rootPage) {
      const { newState: rootPageState } = this.makeState(rootPage);
      this.history.push(rootPageState);
      this.updateUrl(rootPageState);
    }

    const stack = [...this.getActiveNodes(page)];

    while (stack.length) {
      const node = stack.shift();

      const state: NavigatorState = {
        page: node.name,
        modal: null,
        params: this.getActiveParams([node], params),
      };

      this.history.push(state);
      this.updateUrl(state);
    }
  };

  private currentPointer = 0;

  /**
   * Метод обработки события popstate, обеспечивает переход по внутреннему стеку истории роутера.
   * При достижении первого вхождения дальнейшие переходы назад в браузере
   * заменяются на первое вхождение в историю через history.replaceState
   */
  private onPopState = (event: PopStateEvent) => {
    const pointer = event.state?.counter;
    const [rootState] = this.history;
    const pointedState = this.history[pointer];
    const nextState = pointedState || rootState;
    this.currentPointer = pointer;
    /**
     *
     */
    if (pointer !== undefined) {
      this.replaceState(nextState);
    } else if (pointer === undefined || !pointedState) {
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
  private done = (opts?: Record<string, any>) => {
    if (opts.redirect) {
      this.go(opts.redirect.name, {}, { replace: true });
    }
  };

  /**
   * Метод для выполнения callback функций переданных в метод go
   */
  public setActiveTree = (treeName: string) => {
    if (this.trees[treeName]) {
      this.tree = this.trees[treeName];
    } else {
      this.errorLogger(ERROR_TREE_DOESNT_EXIST);
    }
  };

  /**
   * Метод для добавления дерева навигации
   */
  public addTree = (treeName: string, routes: NavigatorRoute[]) => {
    if (!this.trees[treeName]) {
      const tree = createRoutesTree(routes);
      this.trees[treeName] = tree;
    } else {
      this.errorLogger(ERROR_TREE_ALREADY_EXIST);
    }
  };

  /**
   * Метод для удаления дерева навигации
   */
  public removeTree = (treeName: string) => {
    if (this.trees[treeName]) {
      this.tree = this.trees[treeName];
    } else {
      this.errorLogger(ERROR_TREE_DOESNT_EXIST);
    }
  };

  /**
   * Метод полностью заменяет состояние роутера на указанное в аргументе.
   * Для роута, на который осуществляется переход, и который не является модалкой,
   * выполняет функцию из коллекции routeHandlerCollection.
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
    } else {
      this.errorLogger(ERROR_ALREADY_SUBSCRIBED);
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
    if (node) {
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
   * переданного имени роута, параметров, а так же текущего активного дерева роутов
   * */
  private makeState = (
    routeName: string,
    routeParams: NavigatorParams = {}
  ) => {
    const prevState = this.getState();
    const routeNode: RouteNode = this.tree.getRouteNode(routeName);

    const { data: routeData } = routeNode || { data: null };
    const { subRouteKey } = this.config;

    const activeNodes = this.getActiveNodes(routeName);

    let params: NavigatorParams = { ...routeParams };

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
        modal: routeNode.name,
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
    const historyLength = this.history.length;
    const prevHistoryState = this.history[historyLength - 2];
    const isBack = deepEqual(prevHistoryState, newState);

    if (options.firstLoad) {
      const beforeHistoryState = this.history[historyLength - 1];
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
    opts: NavigatorOptions = {},
    title: string = ""
  ) => {
    const stateToHistory = {
      ...state,
      ...state.params,
      counter: this.history.length - 1,
    };

    if (opts.fakeEntry) {
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
    const location = browser.getLocation(this.config, search);
    const url = `${location}${this.config.base}`;

    if (opts.replace) {
      browser.replaceState(stateToHistory, title, url);
    } else {
      browser.pushState(stateToHistory, title, url);
    }
  };

  /**
   * Метод навигации назад - дергает history.back()
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
    opts?: NavigatorOptions
  ) => {
    const initState = this.getState();
    const { defaultRoute } = this.config;
    const [firstRoute] = this.routes;
    /**
     * Установка роутера в активное состояние
     */
    this.isStarted = true;
    /**
     * Привязка обработчика popstate
     */
    this.removePopStateListener = browser.addPopstateListener(
      this.onPopState,
      this.config
    );
    /**
     * Привязка обработчика перехвата нажатия на ссылки
     */
    this.removeLinkPressListener = browser.addLinkInterceptorListener(
      this.buildState,
      this.go
    );
    /**
     * Заполнение стека истории до перехода на активный роут
     */
    this.buildHistory();
    /**
     * Выполнение перехода на начальный роут и добавление записи в историю,
     * обработка случая если роуты отсутствуют.
     */
    if (initState && initState.page) {
      const routeName = initState.modal || initState.page;
      const params = initState.params;

      this.go(routeName, params, { firstLoad: true });
    } else if (startRoute) {
      this.go(startRoute, params, opts);
    } else {
      if (defaultRoute) {
        this.go(defaultRoute);
      } else {
        if (firstRoute && firstRoute.name) {
          this.go(firstRoute.name);
        } else {
          this.errorLogger(ERROR_NO_ROUTES);
        }
      }
    }
  };

  /**
   * Метод жизненного цикла роутера, деактивирует роутер, удаляет обработчики событий.
   * */
  public stop = () => {
    /**
     * Установка роутера в неактивное состояние
     */
    this.isStarted = false;
    this.removeLinkPressListener();
    this.removePopStateListener();
  };

  /**
   * Метод жизненного цикла роутера, возвращает текущее состояние роутера.
   * */
  public getState: NavigatorGetState = (opts = {}) => {
    const { withoutHistory = false } = opts;
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
  public getPrevState: NavigatorGetState = (opts = {}) => {
    if (opts.withoutHistory) {
      const { history, ...state } = this.prevState;
      return state;
    }
    return this.prevState;
  };

  /**
   * Утилита роутера, возвращает булево значение
   * является ли переданный роут с параметрами активным в данном состоянии роутера.
   * */
  
  public isActive = (
    routeName: string,
    routeParams?: NavigatorParams,
    strictCompare: boolean = true,
    ignoreQueryParams: boolean = false // игнорирование необязятельных query параметров,
  ) => {
    const state = this.getState({ withoutHistory: true });
    const activeStateParams = state.params;
    const activeRouteNodes = this.getActiveNodes(state.page);
    const acitveModalNodes = this.getActiveNodes(state.modal);
    const activeNodes = activeRouteNodes.concat(acitveModalNodes);
    const activeNode = activeNodes.find(
      (el: RouteNode) => el.name === routeName
    );
    const isActiveNode = !!activeNode;
    const requiredNodeParams = this.getRequiredParams(activeNode);
    const compareRouteParams = ignoreQueryParams ? cleanFields(requiredNodeParams, routeParams) : routeParams;
    const hasParamsInState = hasProperties(activeStateParams, compareRouteParams);

    const { newState: compareState } = this.makeState(routeName, compareRouteParams);

    const areSameStates = deepEqual(state, compareState);

    if (strictCompare) {
      return areSameStates;
    } else if (routeParams && Object.keys(routeParams).length) {
      return areSameStates || (isActiveNode && hasParamsInState);
    }

    return areSameStates || isActiveNode;
  };

  /**
   * Метод жизненного цикла роутера, добавляет во внтруеннюю коллекцию обработчик
   * выполняемый при переходе на указанный роут
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
