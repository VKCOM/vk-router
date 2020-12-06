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
  NavigatorParams,
  NavigatorCloseModalOpts,
  NavigatorRouteHandler,
  NavigatorRouteHandlerCollection,
  NavigatorErrorLogger,
  NavigatorDone,
  NavigatorMeta,
  NavigatorStateSource,
} from './types';

import {
  ERROR_NO_ROUTES,
  ERROR_ROUTER_NOT_STARTED,
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
  defaultRoute: '',
  base: '',
  subRouteKey: 'subRoute',
  routeKey: 'route',
  preserveHash: false,
  preservePath: true,
  fillStackToBrowser: false,
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
  private isStarted = false;
  /**
   * Логгер ошибок роутера - используется по всему модулю
   */
  private readonly errorLogger: NavigatorErrorLogger = (err) => console.log(err);
  /**
   * Коллекция деревьев навигации, может быть использована для смены заданной навигации
   * через метод setActiveTree
   */
  public trees: Record<string, TreeRoutes> = {};
  /**
   * Текущее активное дерево
   */
  private tree: TreeRoutes;
  /**
   * указатель в стеке роутера
   */
  private stackPointer = 0;
  /**
   * id cессии вкладки
   */
  private uniqueBrowserSessionId: string = '';

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
   * и задает fallback состояние по умолчанию, на которое можно перейти в случае ошибки.
   */
  private readonly initialize = () => {
    if (window.history.state?.fakeEntry) {
      window.history.back();
    }

    const firstRouteName = (this.routes[0] || {}).name;
    const page = this.config.defaultRoute || firstRouteName;

    this.defaultState = {
      page,
      modal: null,
      params: {},
      meta: {
        source: 'default',
      },
    };
    /**
     * собираем начальное состояние из URL
     */
    const initState = this.buildState(browser.getLocation(this.config), 'go');
    this.setState(initState);
    this.uniqueBrowserSessionId = uniqueBrowserSessionId();
  };

  /**
   * Метод получения копии внутреннего стека истории роутера
   */
  public getHistory() {
    return [...this.history];
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
     * Вхождение в историю для defaultRoute
     * если мы не на рутовой странице то:
     */
    if (page !== defaultRoute) {
      const { newState: defaultRouteState } = this.makeState(defaultRoute, null, 'default');
      this.history.push(defaultRouteState);

      if (this.config.fillStackToBrowser) {
        this.updateUrl(defaultRouteState);
      }
    }
    /**
     * Заполняем стек для остальных страниц, если не задан defaultRoute,
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
          source: 'go',
        },
      };

      this.history.push(state);

      if (this.config.fillStackToBrowser) {
        this.updateUrl(state);
      }
    }
  
    const lastEntry = this.history[this.history.length - 1];
    if(!deepEqual(lastEntry, initState)) {
      this.history.push(initState);
      this.updateUrl(initState);
    }
    this.stackPointer = this.history.length - 1;

    const lastState = this.history[this.history.length - 1];
    if (deepEqual(
      { ...lastState, meta: null },
      { ...initState, meta: null })
    ) {
      this.history.pop();
      this.updateUrl(initState, { replace: true });
    }
  };

  /**
   * Метод обработки события popstate, обеспечивает переход по внутреннему стеку истории роутера.
   * При достижении первого вхождения дальнейшие переходы назад в браузере
   * заменяются на первое вхождение в историю через history.replaceState
   */
  private readonly onPopState = (event: PopStateEvent) => {
    const { counter, ...browserState } = event.state || {};
    const [rootState] = this.history;
  
    const pointedState = this.history[counter] || browserState;
    const nextState = pointedState || rootState;
  
    this.stackPointer = counter;

    if ( this.config.fillStackToBrowser) {
      if (counter !== undefined) {
        this.replaceState({
          ...nextState,
          meta: { source: 'popstate' },
        });
      } else if (!pointedState) {
        this.replaceState({
          ...rootState,
          meta: { source: 'popstate' },
        });
      } 
    } else {
      const isSameSession =
        event.state?.browserSessionId === this.uniqueBrowserSessionId;
      /**
       * Заменяем текущее состояние если идем обратно.
       * Если страницы нет в стеке - заменяем на rootState
       * Еcли запись из стека браузера не из этой cессии - заменяем на rootState
       */
      if (this.stackPointer !== undefined && isSameSession) {
        this.replaceState({
          ...nextState,
          meta: { source: 'popstate' },
        });
      } else if (!isSameSession || !pointedState) {
        this.replaceState({
          ...rootState,
          meta: { source: 'popstate' },
        });
        this.updateUrl({ ...rootState, counter: 0 }, { replace: true });
      }
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
  private readonly buildState = (url: string, source: NavigatorStateSource = 'url') => {
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
          source,
        },
      };
    }

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
  }


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
        if (node.parent?.name) {
          stack.push(node.parent);
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
    };

    if (routeNode?.data?.[subRouteKey]) {
      newState = {
        page: prevState.page,
        params: {
          ...prevState.params,
          ...routeParams,
        },
        meta,
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
    if (!this.isStarted) {
      this.errorLogger(ERROR_ROUTER_NOT_STARTED);
    }    
    const { newState, routeData, encodeParams, decodeParams } = this.makeState(
      routeName,
      routeParams,
      'go'
    );
    const historyLength = this.history.length;
    const prevHistoryState = this.history[historyLength - 2];
    const sameState = deepEqual(
      { ...this.state, meta: null },
      { ...newState, meta: null }
    );
    const isBack = deepEqual(prevHistoryState, newState);
    if (sameState) {
      this.broadCastState();
      return;
    }

    if (options.replace) {
      this.history.pop();
      this.history.push(newState);
    } else if (isBack) {
      this.history.pop();
    } else {
      this.history.push(newState);
    }

    this.stackPointer = this.history.length - 1;
    
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

    if (routeData?.updateUrl !== false) {
      this.updateUrl(newState, options);
    } else {
      /**
       * помечаем фейковое вхождение
       */
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
    title = ''
  ) => {
    const lastHistoryIndex = this.history.length - 1;
    let stateToHistory: Record<string, any> = {
      ...state,
      browserSessionId: this.uniqueBrowserSessionId,
      counter: lastHistoryIndex,
    };

    if (opts.replace) {
      stateToHistory = {
        ...state,
        browserSessionId: this.uniqueBrowserSessionId,
        counter: state.counter ?? lastHistoryIndex,
      };
    }

    if (opts.fakeEntry) {
      const currentUrl = browser.getLocation(this.config);
      stateToHistory = {
        ...state,
        browserSessionId: this.uniqueBrowserSessionId,
        counter: state.counter ?? lastHistoryIndex,
        fakeEntry: true,
      }
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
   * Метод навигации назад. Можем шагнуть дальше чем на шаг назад, но только назад
   * */    
  public back: VoidFunction = (position?: number) => {
    const browserStackLen = window.history.length;
    if (this.config.fillStackToBrowser) {
      window.history.back();
    } else if (browserStackLen > 2) {
      if (Number.isInteger(position) && position < 0) {
        window.history.go(position);
      } else {
        window.history.back();
      }
    } else {
      const [rootState] = this.history;
  
      if (Number.isInteger(position) && position < 0) {
        this.stackPointer = position < 0 ? this.stackPointer - position : position; 
      } else {
        this.stackPointer--;
      }

      const prevState = this.history[this.stackPointer] || rootState;  
      this.replaceState(prevState);
      this.updateUrl(prevState, { replace: true });
    }
  };

  public forward: VoidFunction = () => {
    const browserStackLen = window.history.length;
    const routerStackLen = this.history.length;
  
    if (this.config.fillStackToBrowser) {
      window.history.back();
    } else if (browserStackLen >= routerStackLen) {
      window.history.forward();
    } else {

      this.stackPointer++;

      const nextRecord = this.history[this.stackPointer];
      if (nextRecord) {  
        this.updateUrl(nextRecord, { replace: true });
      }
    }
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
        if (firstRoute?.name) {
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
   * Метод закрытия для модальных окон. 
   * closeSequence - история отматывается до страницы без модального окна, 
   * иначе действует как this.back
  */
  public closeModal = ({ closeSequence = true }: NavigatorCloseModalOpts = {}) => {
    const { modal, page } = this.state;
    if(window.history.length)
    if (closeSequence) {
      if (modal && page) {
          const historyStack = [...this.history];
          let noModalState = this.state;
          console.log('this.history', this.history);
          while (noModalState.page === page && noModalState.modal) {
            noModalState = historyStack.pop();
          }
          
          this.setState(noModalState);
        } else {
          this.back();
        }
      } else {
        this.back();
      }
  }
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
      state?.meta?.source, // чтобы создавать корректный стейт для сравнения
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
