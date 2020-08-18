import { createRouterCore, WrapperConfig as NavigatorConfig, CoreRouter, CoreRoute, CoreSubscribeFn, CoreRouterState } from './RouterCore';  

export interface CreateNavigatorOptions {
  routes?: NavigatorRoute[];
  config?: NavigatorConfig 
}

export type CreateNavigator = (
  options: CreateNavigatorOptions
) => Navigator;

export interface NavigatorSubRoutes{
  [key:string]: any,
}

export interface NavigatorParams {
  [key:string]: any,
} 

export interface NavigatorHistoryRecord {
    name: string,
    path: string,
    params? : { [key: string]: any }
}

export interface NavigatorState {
    route?: string,
    core?: CoreRouter,
    path?: string,
    subRoute?: string,
    previousRoute?: string,
    history?: NavigatorHistoryRecord[],
    go?: Function,
    back?: VoidFunction,
    config?: NavigatorConfig,
    params?: NavigatorParams,
    subRouteParams?: NavigatorParams,
    navigator?: Navigator,
}

export interface NavigatorStatesToSubscriber {
  toState: NavigatorState; 
  fromState: NavigatorState;
}

export type NavigatorSubscriber = (state: NavigatorStatesToSubscriber) => void;

export interface NavigatorRoute {
  name: string,
  path: string,
  subRoute?:string,
  params?:any,
  subouteParams?:any
}

const defaultConfig: NavigatorConfig = {    
  base: ".",
  defaultRoute: '/',
  useHash: false,  
};
 
export class Navigator {

  public state: NavigatorState = {};
  public prevState: NavigatorState = {};
  
  public routes: NavigatorRoute[] = [];
  public subRoutes: NavigatorSubRoutes = {};
  public config: NavigatorConfig = {};
  

  private subscribers: NavigatorSubscriber[] = [];  
  private router: CoreRouter;

  constructor ({ routes, config }: CreateNavigatorOptions) { 
    this.routes = routes;  
    this.config = config;

    this.router = this.state.core = createRouterCore({
      routes: this.proccessRoutes(this.routes), 
      config: this.config
    }); 
                  
    this.router.subscribe(this.syncNavigatorStateWithCore); 
    const initState = this.router.getState(); 
    console.log('Core state', initState);

    if(initState){
      const { name: route, path, params } = initState;
      const history = [{ name, path, params }];

      this.buildFakeHistory();
      
      this.setState({
          route,
          path,
          history,
          go: this.go,
          back: this.back,
          config,
          params,
          navigator: this,
      });
    }
  } 

  private buildFakeHistory = () => {

    /**
     *  Достраиваем историю в том случае если мы перешли нарпямую 
     *  достраиваем и в стек браузера и в стек истории модуля
     */
    const browserHistory = window.history;
    const { history } = this.state;
    if(browserHistory.length <= 2){ 
      const { origin, hash, pathname } = window.location;
      const hashMode = !!hash;
      const address = hashMode ? hash.replace('#', '') : pathname; 
      const paths = address.split('/').filter((path: string) => path);
      
      let pathstring = hashMode ? '#': '';
       
      paths.forEach((path: string) => {
          const historyRecords: NavigatorHistoryRecord[] = 
            this.routes
                .filter(({ path }:NavigatorRoute ) => path.includes(path))
                .map(({name, path}: NavigatorRoute ) => ({ name, path }));

          this.setState({ history: [...history, ...historyRecords] });
         
          pathstring += `/${path}`;         
          browserHistory.pushState(null, null, `${origin}${pathstring}`);
      });
    }
  }

  private proccessRoutes=(routes: NavigatorRoute[]): CoreRoute[] => { 
    return routes;
  }

  private broadCastState = () => {
     const toState = this.getState();
     const fromState = this.getPrevState();
     this.subscribers.forEach((subscriber: NavigatorSubscriber) => subscriber({ toState, fromState }));
  }
  
  private setState = (state: Partial<NavigatorState>) => {
    this.prevState = {...this.state};
    this.state = {...this.state, ...state};
    this.broadCastState();
  }

  private syncNavigatorStateWithCore: CoreSubscribeFn = ({ route: coreState, previousRoute: prevCoreState }) => {
    const { name, params, path, meta } = coreState;  
    const { name: prevName, params: prevParams } = prevCoreState;
    const { history: prevHistory = [] } = this.state;

    const history = [
      ...prevHistory,
    ] 
 
    //Вхождение в историю одинаковое для route и  subroute

    if(params.replace){
      history.pop();
    } else {
      history.push({
        name,
        path,
        params,
      });
    }
    /**
     * Проверяем следующее состояние роутера
     * если следующий роут - это subroute текущего, то:
     * route =  остается тем же самым
     * subroute = устанавливается в текущее значение
     * 
     * Неизвестно, хранятся ли параметры внутри объекта роута 
     */
    const isSubRoute = !!meta.params.subRoute; 
    const route = isSubRoute ? prevName: name;
    const subRoute = isSubRoute ?  null : name;
    const subRouteParams = isSubRoute ? params : null;
    const routeParams = isSubRoute ? prevParams : prevParams;

    const navigatorState = {
      route,
      subRoute, 
      subRouteParams,     
      history,
      params: routeParams,
    } 

    this.setState(navigatorState);
    console.log('sync fired',  navigatorState);
  }
 
  public subscribe=(subscriber: NavigatorSubscriber) => {
    if(!this.subscribers.includes(subscriber)){
      this.subscribers.push(subscriber);

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
      this.routes = [...this.routes, ...routes]
      this.router.add(this.proccessRoutes(routes)); 
    }
  }

  public remove = (route: string) => {
    
  }

  private checkIfSubRoute = (to:string) =>{
    
    return this.state.core
  }

  public go = (to: string, params?: any, options?: any) => {
     
    if(this.checkIfSubRoute(to)){
      options.replace = true;
      /**
       * Если subroute  = true
       * Не обновлять url при открытии под роута если 
       * не заменять параметры в текущем урле, если
       */
    }
    
    this.router.navigate(to, params, options);
  }
 
  public back: VoidFunction = () => {
    const { history } = this.state;
    const prevLocation = history[history.length - 2];
    if(prevLocation){
      this.go(prevLocation.name)
    }
  };

  public start = (params?: string | CoreRouterState) => {  
     this.router.start(params);
  }

  public stop = () => { 
     this.router.stop()
  } 
  
  public getState = () => {
    return this.state;
  }

  public getPrevState = () => {
    return this.prevState;
  }

}

export const createNavigator: CreateNavigator = ({
  routes, 
  config = defaultConfig,
}) => {
  return new Navigator({ routes, config });
};