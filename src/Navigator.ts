import { createRouterCore, WrapperConfig as NavigatorConfig, CoreRouter, CoreRoute, CoreSubscribeFn } from './RouterCore';  

export interface CreateNavigatorOptions {
  routes: NavigatorRoute[];
  config: NavigatorConfig 
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
  [key:string]: string
}

export interface NavigatorState {
    route: string,
    path: string,
    subRoute?: string,
    previousRoute?: string,
    history: NavigatorHistoryRecord[],
    go: Function,
    back: VoidFunction,
    config: NavigatorConfig,
    params?: NavigatorParams,
    subRouteParams?: NavigatorParams,
}

export type NavigatorSubscriber = (state: NavigatorState) => void;

export interface NavigatorRoute {
  name: string,
  path: string,
  subroute?:string,
  params?:any,
  subRouteParams?:any
}

const defaultConfig: NavigatorConfig = {    
  base: ".",
  useHash: false,  
};
 
export default class Navigator {

  public state: NavigatorState;
  public routes: NavigatorRoute[] = [];
  public subRoutes: NavigatorSubRoutes = {};
  public config: NavigatorConfig = {};
  

  private subscribers: NavigatorSubscriber[] = [];  
  private router: CoreRouter;

  constructor ({ routes, config }: CreateNavigatorOptions) { 
    this.routes = routes;  
    this.config = config;

    this.router = createRouterCore({
      routes: this.proccessRoutes(routes), 
      config
    });
                 
    this.router.subscribe(this.syncNavigatorStateWithCore);
    this.router.start();

    const { name: route, path, params } = this.router.getState();
    const history = [{name: path}];

    this.buildFakeHistory();
    
    this.state = {
        route,
        path,
        history,
        go: this.go,
        back: this.back,
        config,
        params,
    }
  } 

  private buildFakeHistory = () => {

    const browserHistory = window.history;
    
    if(browserHistory.length <= 2){ 
      const { origin, hash, pathname } = window.location;
      const hashMode = !!hash;
      const address = hashMode ? hash.replace('#', '') : pathname; 
      const paths = address.split('/').filter((path: string) => path);
      
      let pathstring = hashMode ? '#': '';
      paths.forEach((path: string) => {
          pathstring += `/${path}`;         
          browserHistory.pushState(null, null, `${origin}${pathstring}`);     
      });
    }
  }

  private proccessRoutes=(routes: NavigatorRoute[]): CoreRoute[] => { 
    return routes;
  }

  private broadCastState = () => {
     const state = this.getState();
     this.subscribers.forEach((subscriber: NavigatorSubscriber) => subscriber(state));
  }
  
  private setState = (state: Partial<NavigatorState>) => {
    this.state= {...this.state, ...state};
    this.broadCastState();
  }

  private syncNavigatorStateWithCore: CoreSubscribeFn = ({ route }) => {
    const { name, params, path } = route;  
    const { history } = this.state;
   
    if(params.replace){
      history.pop();
    } else {
      history.push({ name: path });
    }
     
    this.setState({
        route: name, 
        subRoute: '',  
        history,
        params,
    })
  }
 
  public subscribe=(subscriber: NavigatorSubscriber) => {
    if(!this.subscribers.includes(subscriber)){
      this.subscribers.push(subscriber);
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

  public go = (to: string, params?: any, options?: any) => {
    const route = to || this.router.getState().name;
    this.router.navigate(route, params, options);
  }
 
  public back: VoidFunction = () => {
    window.history.back();
  }; 

  public start = () => {  
     this.router.start();
  }

  public stop = () => { 
     this.router.stop()
  } 
  
  public getState = () =>{
    return this.state;
  }

}

export const createNavigator: CreateNavigator = ({
  routes, 
  config = defaultConfig,
}) => {
  return new Navigator({ routes, config });
};