 

import { buildFakeHistory } from './utils';

export type NavigatorConfig = Partial<RouterConfig>;

export type CreateRouterInstanceOptions  = (
  routes: any[],
  config?: NavigatorConfig 
)=> Router; 
 
export type EncodeParams = () => string;

export type DecodeParams = () => string[]; 
  
export interface Route {
    [key:string]: any,
    name: string,
    path: string,
    encodeParams?: EncodeParams,
    decodeParams?: DecodeParams, 
    children?: Route[],
    params?: {[key: string]: any}
    meta?: {[key: string]: any}
}

export interface RouterState {
    disabled: boolean,
    subscribers: Function[],
    currentRoute?: Route,
    history: string[],
    routes: Route[],
    middlewares?: Middlewares,
    params?: {[key:string]: any},
    options?: {[key:string]: any},     
    root: string, 
}

export interface Middleware {

}

export interface Middlewares {
    [key: string]: Middleware
}

export interface RouterConfig {
    base: string,
    useHash?: boolean,
    defaultRoute: string,
    persistentParams?: string[],
    routes?: Route[],
    middlewares?: Middlewares,    
}

type StateCallback = (state: {[key:string]: any}) => {[key:string]: any};

type Go = (route: string, params: {[key:string]: any}, options: {[key:string]: any}) => void;

const defaultRouterConfig = {}

export class Router {

    public state: RouterState = {
        disabled: true,
        subscribers: [],
        history: [],
        routes: [], 
        params: {},
        options: {},     
        root: '/'
    };

    constructor(params: RouterConfig){
        //this.buildStateHistory();
        //this.buildFakeHistory();

        this.setState({
            ...params
        });
    }
 
    broadCastState = () =>{
        const currentState = this.getState();
        this.state.subscribers.forEach(subscriber=> subscriber(currentState));
    }


    public start = () => {
        this.setState({ disabled: false });
    }

    public stop = () => {
        this.setState({ disabled: true });
    }

    public subscribe = (subscriber: Function) =>{
        //this.subscribers   
    }

    public unsubscribe = (subscriber: Function) =>{

    }

    public removeAllSubScribers = () =>{
        this.setState({subscribers: []});
    } 

    private setRouterState = () =>{}

    private matchUrl = ()=> {};
    
    private removeSlashes = () => {}

    private buildPath = () =>{}

    private buildStateHistory = () =>{}
    
    private buildFakeHistory = () =>{
      if(window.history.length <= 2){
        const url  = window.location.toString();
        buildFakeHistory(url);
      }
    }

    private buildUrl = () =>{
      
    };   

    private handleChildrenRoutes = () => {}

    private handleRoutes = () =>{}

    private calculateTransition = () => {}

    private checkRouteExists = (route:Route) =>{

      return true;
    }

    public getState = () =>{
        return this.state;
    }

    private setState = (param: {[key:string]:any } | StateCallback) => {   
        let newState = {};
        if(typeof param === 'function') {
            newState = param(this.state)
          }
          else {
            newState = param;
        }
        this.state = {...this.state, ...newState};
        this.buildUrl();
    }

    public add = (route: RouteDefinition) => {
        this.setState({
            routes: [...this.state.routes, route]
        })
    }

    public remove = (route: RouteDefinition) => {}

    public go:Go = (route, params, options) =>{       
        if(this.checkRouteExists(route)){
            const {replace, ...restOptions} = options;
            if(replace){
              this.setState({
                route: {...route, meta: {...restOptions}}, 
             }) 
          }
        }
    }
    
    public back = () =>{
        window.history.back;
    }
};

export const createRouter: CreateRouterInstanceOptions = (routes, config) =>{

    return new Router(routes, config)
}
