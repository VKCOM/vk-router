import { createRoutesTree } from './tree/Tree';
import {
  buildQueryParams,
  getQueryParams,
  urlToPath,
  deepEqual,
  hasProperties,
  cleanFields,
  uniqueBrowserSessionId,
} from './utils';
import {
  NavigatorRoute,
  NavigatorState,
  NavigatorGetState,
  NavigatorHistoryRecord,
  NavigatorSubscriber,
  NavigatorConfig,
  NavigatorOptions,
  NavigatorCloseModalOpts,
  NavigatorParams,
  NavigatorRouteHandler,
  NavigatorRouteHandlerCollection,
  NavigatorErrorLogger,
  NavigatorDone,
  NavigatorMeta,
  NavigatorStateSource,
} from './types';

import {
  ERROR_NO_ROUTES,
  // ERROR_HAS_TO_BE_ROUTE,
  ERROR_TREE_DOESNT_EXIST,
  ERROR_TREE_ALREADY_EXIST,
  ERROR_TREE_NO_ROUTE,
  ERROR_ALREADY_SUBSCRIBED,
} from './constants';

import browser from './browser';
import TreeRoutes from './tree/Tree';
import RouteNode from './tree/RouteNode';

/**
 * Объект конфигурации по умолчанию
 */
const defaultConfig: NavigatorConfig = {
  defaultRoute: 'default',
  base: '',
  subRouteKey: 'subRoute',
  routeKey: 'route',
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
   * Текущая позиция в стеке навигации
   */
  private stackPointer = 0;
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
  private isStarted = false;
  /**
   * Логгер ошибок роутера - используется по всему модулю
   */
  private readonly errorLogger: NavigatorErrorLogger = (err) => console.log(err);
  /**
   * Коллекция деревьев навигации, может ббыть использована для смены заданной навигации
   * через метод setActiveTree
   */
  public trees: Record<string, TreeRoutes> = {};
  /**
   * Текущее активное дерево
   */
  private tree: TreeRoutes;

  private browserSessionId: string;

  private modalSequence = 0;

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
  private readonly initialize = () => {
    const firstRouteName = (this.routes[0] || {}).name;
    const page = this.config.defaultRoute || firstRouteName;

    this.defaultState = {
      page,
      modal: null,
      params: {},
      meta: {
        source: 'default',
      },
      options: {},
    };
    /**
     * собираем начальное состояние из URL
     */
    const initState = this.buildState(browser.getLocation(this.config));
    this.browserSessionId = uniqueBrowserSessionId();
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
  private readonly buildHistory = () => {
    const initState = this.getState();
    const { page, params } = initState;
    const { defaultRoute } = this.config;
    /**
     * Вхождение в историю для rootPage
     * если мы не на рутовой странице то:
     */
    if (page !== defaultRoute) {
      const { newState: rootPageState } = this.makeState(defaultRoute, null, null, 'default');
      this.history.push(rootPageState);
      this.updateUrl(rootPageState);
    }
    /**
     * Заполняем стек для остальных страниц, если не задан rootPage,
     * то рутовым станет первое вхождение в историю
     */
    const stack = [...this.getActiveNodes(page)];

    while (stack.length) {
      const node = stack.shift();

      const state: NavigatorState = {
        page: node.name,
        modal: null,
        params: this.getActiveParams([node], params),
        meta: {
          source: 'popstate',
        },
      };

      this.history.push(state);
      this.updateUrl(state);
    }

    const lastState = this.history[this.history.length - 1];
    if (deepEqual(
      { ...lastState, meta: null, options: null },
      { ...initState, meta: null, options: null })
    ) {
      this.history.pop();
      this.updateUrl(initState, { replace: true });
    }

    this.stackPointer = this.history.length - 1;
  };

  /**
   * Метод обработки события popstate, обеспечивает переход по внутреннему стеку истории роутера.
   * При достижении первого вхождения дальнейшие переходы назад в браузере
   * заменяются на первое вхождение в историю через history.replaceState
   */
  private readonly onPopState = (event: PopStateEvent) => {
    const pointer = event.state?.counter;
    const [rootState] = this.history;
    const pointedState = this.history[pointer];
    const nextState = pointedState || rootState;
    const useSameSession = this.config.fillStack
      ? event.state?.browserSessionId === this.browserSessionId
      : true;

    /**
     * Заменяем текущее состояние если идем обратно.
     * Если страницы нет в стеке - заменяем на rootState
     * Еcли запись из стека браузера не из этой cессии - заменяем на rootState c defaultRoute
     */
    if (pointer !== undefined && useSameSession) {
      this.stackPointer = pointer;
      this.replaceState({
        ...nextState,
        meta: { source: 'popstate' },
      });
    } else if (!useSameSession || !pointedState) {
      this.stackPointer = 0; // defaultRoute index;
      this.replaceState({
        ...rootState,
        meta: { source: 'popstate' },
      });
      this.updateUrl({ ...rootState, counter: 0 }, { replace: true });
    }
  };

  /**
   * Метод жизненного цикла роутера для передачи состояния и стека истории в подписчики
   */
  private readonly broadCastState = () => {
    const toState = this.getState();
    const fromState = this.getPrevState();
    const history = this.getHistory();
    this.subscribers.forEach((subscriber: NavigatorSubscriber) =>
      subscriber({
        toState,
        fromState,
        history,
      })
    );
  };

  /**
   * Метод для выполнения callback функций переданных в метод go
   */
  private readonly done = (opts?: Record<string, any>) => {
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
  private readonly replaceState = (state: NavigatorState) => {
    const prevState = { ...this.state };
    const nextState = { ...state };

    if (!deepEqual(prevState, nextState)) {
      const handlerCanActivate = this.routeHandlerCollection[nextState.page];
      // handlerCanActivateSubroute = this.routeHandlerCollection[nextState.subroute];
      this.state = nextState;
      this.prevState = prevState;
      if (typeof handlerCanActivate === 'function') {
        handlerCanActivate(nextState, prevState, this.done);
      }
    }
    this.broadCastState();
  };

  /**
   * Метод жизненного цикла роутера - устанавливает переход в новое состояние роутера.
   * Пока выполняется синхронно.
   */
  private readonly setState = (state: Partial<NavigatorState>) => {
    const prevState = { ...this.state };
    const nextState = { ...this.state, ...state };

    if (!deepEqual(prevState, nextState)) {
      const handlerCanActivate = this.routeHandlerCollection[nextState.page];
      // handlerCanActivateSubroute = this.routeHandlerCollection[nextState.subroute];
      this.state = nextState;
      this.prevState = prevState;
      if (typeof handlerCanActivate === 'function') {
        handlerCanActivate(nextState, prevState, this.done);
      }
    }
    this.broadCastState();
  };

  /**
   * Метод создания состояния на основе переданного URL в инициализированный роутер,
   * используется для получения начального состояния роутера
   */
  private readonly buildState = (url: string) => {
    const path = urlToPath(url, this.config);
    const { p: page, m: modal = null, ...routeParams } = getQueryParams(path);
    const RouteNode = this.tree.getRouteNode(page);

    let State: NavigatorState = this.defaultState;
    let params = routeParams;
    if (RouteNode) {
      if (RouteNode.decodeParams) {
        params = RouteNode.decodeParams(routeParams);
      }

      State = {
        page,
        modal,
        params,
        meta: {
          source: 'url',
        },
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
  public buildSearch = (
    routeName: string,
    params: NavigatorParams = {}
  ): string => {
    const { newState: state, encodeParams } = this.makeState(routeName, params);
    const { page, modal, params: stateParams } = state;
    let toStateParams = stateParams;

    if (encodeParams) {
      toStateParams = encodeParams(stateParams);
    }

    const stateToUrl = {
      p: page,
      m: modal,
      ...toStateParams,
    };
    const buildedSearch = buildQueryParams(stateToUrl, '', this.config);
    const search = buildedSearch.length ? '?' + buildedSearch : '';
    return `${this.config.base}${search}`;
  };

  public buildUrl = (
    routeName: string,
    params: NavigatorParams = {}
  ): string => this.buildSearch(routeName, params);

  /**
   * Метод создания ссылки на основе имени роута и параметров.
   * */
  public buildPath = (
    routeName: string,
    params: NavigatorParams = {}
  ): string => this.buildSearch(routeName, params);

  /**
   * Метод получения коллекции активных узлов,
   * в порядке от корня дерева заканчивая текущим активным роутом
   * */
  private readonly getActiveNodes = (routeName: string) => {
    const activeNodes = [];

    if (routeName) {
      const routeNode = this.tree.getRouteNode(routeName);
      const stack = [routeNode];
      while (stack.length) {
        const node = stack.shift();
        activeNodes.push(node);
        if (node.parent) {
          if (node.parent.name) {
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
  private readonly getRequiredParams = (node: RouteNode) => {
    let params: string[] = [];
    if (node) {
      const stack = [node];

      while (stack.length) {
        const node = stack.shift();
        if (node) {
          if (node.params) {
            params = params.concat(node.params);
          }
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
  private readonly getActiveParams = (
    activeNodes: RouteNode[],
    paramsPool: Record<string, any>
  ) => {
    const activeParams: Record<string, any> = {};
    const stack = [...activeNodes];
    while (stack.length) {
      const node = stack.shift();
      const keys: string[] = this.getRequiredParams(node);

      keys.forEach((key) => {
        activeParams[key] = paramsPool[key];
      });
    }

    return activeParams;
  };

  /**
   * Утилита роутера, выполняет построение состояния роутера на основе
   * переданного имени роута, параметров, а так же текущего активного дерева роутов
   * */
  private readonly makeState = (
    routeName: string,
    routeParams: NavigatorParams = {},
    options: NavigatorOptions = {},
    stateSource?: NavigatorStateSource,
  ) => {
    const prevState = this.getState();
    const routeNode: RouteNode = this.tree.getRouteNode(routeName);
    const { subRouteKey } = this.config;

    const { data: routeData, decodeParams, encodeParams } = routeNode;

    const activeNodes = this.getActiveNodes(routeName);

    const meta: NavigatorMeta = { source: stateSource || 'default' };
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
      meta,
      options,
    };

    if (routeNode?.data?.[subRouteKey]) {
      newState = {
        page: prevState.page,
        params: {
          ...prevState.params,
          ...routeParams,
        },
        meta,
        options,
        modal: routeNode.name,
      };
    }

    return { newState, routeData, activeNodes, encodeParams, decodeParams };
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
    const { newState, routeData, encodeParams, decodeParams } = this.makeState(
      routeName,
      routeParams,
      options,
      'go'
    );
    const historyLength = this.history.length;
    const prevHistoryState = this.history[historyLength - 2];
    const sameState = deepEqual(
      { ...this.state, meta: null },
      { ...newState, meta: null }
    );
    const isBack = deepEqual(prevHistoryState, newState);

    if (!this.state.modal && newState.modal && !isBack) {
      this.modalSequence = window.history.length;
    } else if (!newState.modal) {
      this.modalSequence = 0;
    }

    if (sameState && !options.firstLoad) {
      this.broadCastState();
      return;
    }

    if (options.replace) {
      this.history[this.stackPointer] = newState;
    } else if (isBack) {
      this.stackPointer--;
      this.history.pop();
    } else {
      this.stackPointer++;
      this.history.push(newState);
    }

    if (decodeParams) {
      newState.params = decodeParams(newState.params);
    }

    const areSameParams = deepEqual(this.state.params, newState.params);
    /**
     * Для отработки хуков которые зависят от того, обновился объект параметров или нет
     * сохраняем ссылку на объект параметров предыдущего стейта если параметры не изменились
     */
    if (areSameParams) {
      newState.params = this.state.params;
    }

    this.setState(newState);

    const prevState = this.getPrevState();

    if (encodeParams) {
      newState.params = encodeParams(newState.params);
    }

    if (routeData && routeData.updateUrl !== false) {
      this.updateUrl(newState, options);
    } else {
      this.updateUrl(prevState, { ...options, fakeEntry: true });
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
    title = ''
  ) => {
    const counter = this.history.length - 1;
    let stateToHistory: Record<string, any> = {
      ...state,
      browserSessionId: this.browserSessionId,
      counter,
    };

    if (opts.replace) {
      stateToHistory = {
        ...state,
        counter: state.counter ?? counter,
        browserSessionId: this.browserSessionId,
      };
    }

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

    const buildedSearch = buildQueryParams(stateToUrl, '', this.config);
    const search = buildedSearch.length ? '?' + buildedSearch : '';
    const url = browser.getLocation(this.config, search);
    if (opts.replace) {
      browser.replaceState(stateToHistory, title, url);
    } else {
      browser.pushState(stateToHistory, title, url);
    }
  };

  /**
   * Метод закрытия для модальных окон.
   * sequence - история отматывается до активной страницы без модального окна,
   * иначе действует как this.back
   * cutHistory - делает возврат на разницу между текущей историей и историей на момент открытия первого модального окна
  */
  public closeModal = ({ sequence = true, cutHistory = false }: NavigatorCloseModalOpts = {}) => {
    const { modal, page } = this.state;

    const rewindTo = (page: string) => {
      const stack = this.history;
      let noModalState = stack.pop();
      while (noModalState.page === page && noModalState.modal) {
        noModalState = stack.pop();
      };
      stack.push(noModalState);
      this.setState(noModalState);
    };

    if (sequence) {
      if (modal && page) {
        if (cutHistory && this.modalSequence) {
          const historyDiff = this.modalSequence - window.history.length;
          if (historyDiff < 0) {
            window.history.go(historyDiff);
          } else {
            rewindTo(page);
          }
        } else {
          rewindTo(page);
        }
      } else {
        this.back();
      }
    } else {
      this.back();
    }
  };

  /**
   * Метод навигации назад
   * */
  public back: VoidFunction = () => {
    window.history.back();
  };

  /**
   * Метод активирует роутер, выполняет метод построение истории buildHistory,
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
   * Метод деактивирует роутер, удаляет обработчики событий.
   * */
  public stop = () => {
    this.isStarted = false;
    this.removeLinkPressListener();
    this.removePopStateListener();
  };

  /**
   * Метод возвращает текущее состояние роутера.
   * */
  public getState: NavigatorGetState = () => {
    return this.state;
  };

  /**
   * Метод возвращает предыдущее состояние роутера.
   * */
  public getPrevState: NavigatorGetState = () => {
    return this.prevState;
  };

  /**
   * Утилита роутера, возвращает булево значение
   * является ли переданный роут с параметрами активным в данном состоянии роутера.
   * */

  public isActive = (
    routeName: string,
    routeParams?: NavigatorParams,
    strictCompare = true, // строгое сравнение со всеми параметрами
    ignoreQueryParams = false // игнорирование необязятельных query параметров,
  ) => {
    const state = this.getState();
    const activeStateParams = state.params;
    const activeRouteNodes = this.getActiveNodes(state.page);
    const acitveModalNodes = this.getActiveNodes(state.modal);
    const activeNodes = activeRouteNodes.concat(acitveModalNodes);
    const activeNode = activeNodes.find(
      (el: RouteNode) => el.name === routeName
    );
    const isActiveNode = !!activeNode;
    const requiredNodeParams = this.getRequiredParams(activeNode);
    const compareRouteParams = ignoreQueryParams
      ? cleanFields(requiredNodeParams, routeParams)
      : routeParams;

    const hasParamsInState = hasProperties(
      activeStateParams,
      compareRouteParams
    );

    const { newState: compareState } = this.makeState(
      routeName,
      compareRouteParams,
      state.options,
      state.meta.source, // передаем state.meta и state.options чтобы создавать корректный стейт для сравнения
    );

    const areSameStates = deepEqual(state, compareState);
    if (strictCompare) {
      return areSameStates;
    } else if (routeParams && Object.keys(routeParams).length) {
      return areSameStates || (isActiveNode && hasParamsInState);
    }

    return areSameStates || isActiveNode;
  };

  /**
   * Метод добавляет во внтруеннюю коллекцию обработчик
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
