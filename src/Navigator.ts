import { createRouterCore, WrapperConfig as NavigatorConfig, CoreRouter, CoreRoute, CoreSubscribeFn, CoreRouterState } from './RouterCore';  

export interface CreateNavigatorOptions {
  routes?: NavigatorRoute[];
  config?: NavigatorConfig 
}

export type CreateNavigator = (
  options: CreateNavigatorOptions
) => Navigator;

export interface NavigatorSubRoutes {
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
  subRoute?: boolean,
  title?: string,
  children?: NavigatorRoute[],
}

interface NavigatorRouteProperties{
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
  
  public routes: NavigatorRoute[] = [];
  public routeProperties: NavigatorRouteProperties = {};
  public config: NavigatorConfig = {};
  

  private subscribers: NavigatorSubscriber[] = [];  
  private router: CoreRouter;

  constructor ({ routes, config }: CreateNavigatorOptions) { 
    this.routes = routes;  
    this.config = config;

    this.router = createRouterCore({
      routes: this.proccessRoutes(this.routes), 
      config: this.config
    }); 
                  
    this.router.subscribe(this.syncNavigatorStateWithCore); 
    const initState = this.router.matchUrl(window.location.href); 

    if(initState){
      const { name: route, path, params } = initState;
      const history = [{ name, path, params }];
 
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
    this.buildFakeHistory();
  } 

  private buildFakeHistory = () => {

    /**
     *  Достраиваем историю в том случае если мы перешли напрямую 
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

          /**
           * 
           */
        
          const historyRecords: NavigatorHistoryRecord[] = 
            this.routes
                .filter(({ path }:NavigatorRoute ) => path.includes(path))
                .map(({name, path}: NavigatorRoute ) => ({ name, path }));

          this.setState({ history: [...history, ...historyRecords] });
         
          pathstring += `/${path}`;  
          console.log(pathstring);       
          browserHistory.pushState(null, null, `${origin}${pathstring}`);
      });
    }
  }

  /**
   * Метод для обхода входящей коллекции роутов по заданному пути
   * нужен, т.к. router5 не хранит внутри себя доп свойств
   * TODO: найти более эффективный способ добираться до свойств
   */
  private getRouteData = (path:string): NavigatorRoute | null => {
    const pathSegments = path.split('.');   
    let routeData = null; 
    let pathSegmentIndex = 0;
    const target = pathSegments[pathSegments.length - 1];

    const lookForSegment = (routes: NavigatorRoute[])=> {
      for(let i = 0; i < routes.length; ++i){
        const route = routes[i];
        const pathName = pathSegments[pathSegmentIndex];
        if(route.name === pathName){
          if(route.name === target){
            routeData = route;
            break;
          }         
          if(Array.isArray(route.children)){
            pathSegmentIndex +=1;
            lookForSegment(route.children);
          }
          break;
        }
      };
    };

    lookForSegment(this.routes);

    return routeData;
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

  private getParentRoute = (path: string): string => {
    const resultArr = path.split('.');
    resultArr.pop();
    return resultArr.length > 1 ? resultArr.join('.') : resultArr[0];
  }

  private syncNavigatorStateWithCore: CoreSubscribeFn = ({ route: coreState, previousRoute: prevCoreState }) => {
    const { name, params = {}, path, meta } = coreState;  
    const { name: prevName, params: prevParams = {} } = prevCoreState || {};
    const { history: prevHistory = [] } = this.state;
    
    const history = [
      ...prevHistory,
    ] 
 
    //Вхождение в историю роутера одинаковое для route и  subroute

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
     * subroute = устанавливается в текущее значениe
     * если предыдущий роут - тоже subrout
     * то оставляем текущий роут
     */
    
    const routeData = this.getRouteData(name);
    const prevRouteIsSubRoute = this.state.subRoute === prevName; 
    const isSubRoute = routeData && routeData.subRoute;
    const route = isSubRoute 
      ? prevRouteIsSubRoute 
        ? this.state.route : prevName
      : name;

    const subRoute = isSubRoute ?  name : null;
    const subRouteParams = isSubRoute ? params : null;
    const routeParams = isSubRoute ? prevParams : params;
    
    if(isSubRoute){
      this.router.replaceHistoryState(route, routeParams);
    }

    const navigatorState = {
      route,
      subRoute, 
      subRouteParams,     
      history,
      params: routeParams,
    } 

    this.setState(navigatorState);
  }
 
  public subscribe=(subscriber: NavigatorSubscriber) => {
    if(!this.subscribers.includes(subscriber)){
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
      this.routes = [...this.routes, ...routes]
      this.router.add(this.proccessRoutes(routes)); 
    }
  }

  public remove = (route: string) => {
    
  }

  public go = (to: string, params?: any, options: any = {}) => {
    this.router.navigate(to, params, options);
  }
 
  public back: VoidFunction = () => {
    window.history.back;
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