
export type EncodeParams = () => string;

export type DecodeParams = () => string[]; 
 

export interface RouteDefinition {
    name: string,
    path: string,
    encodeParams?: EncodeParams,
    decodeParams?: DecodeParams, 
    children: RouteDefinition[],
    params?: {[key: string]: any}
    meta?: {[key: string]: any}
}

export interface RouterState {
    disabled: boolean,
    subscribers: any[],
    currentRoute?:RouteDefinition,
    history: string[],
    params: {[key:string]: any},
    options: {[key:string]: any},     
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
    routes: RouteDefinition[],
    middlewares: Middlewares
}

type StateCallback = (state: {[key:string]: any}) => {[key:string]: any};
type Go = (route: string, params: {[key:string]: any}, options: {[key:string]: any}) => void;

const defaultRouterConfig = {

}

export class Router {

    public state: RouterState = {
        disabled: true,
        subscribers: [],
        history: [],
        routes: [],
        middlewares: [],
        params: {},
        options: {},     
        root: '/'
    };

    constructor(params: RouterConfig){
        this.buildStateHistory();
        this.buildFakeHistory();

        this.setState({
            params
        });
    }
 
    broadCastState = () =>{
        const currentState=  this.getState();
        this.state.subscribers.forEach(subscriber=> subscriber(currentState));
    }


    public start = () => {
        this.setState({disabled: false});
    }

    public stop = () => {
        this.setState({disabled: true});
    }

    public subscribe = (subscriber: Function) =>{
        //this.subscribers   
    }

    public unsubscribe = (subscriber: Function) =>{

    }

    public removeAllSubScribers = () =>{
        this.setState({subscribers: []}),
    }

    private removeCornerSlashes = (path:string) =>
        path.toString()
        .replace(/\/$/, '')
        .replace(/^\//, '');


    private isEmbedded = () =>{}

    private setRouterState = () =>{}

    private matchUrl = ()=> {};
    
    private removeSlashes = () => {}

    private buildPath = () =>{}

    private buildStateHistory = () =>{}
    
    private buildFakeHistory = () =>{}

    private buildUrl = () =>{}

    private handleChildrenRoutes = () => {}

    private handleRoutes = () =>{}

    private calculateTransition = () => {}

    private checkRouteExists = () =>{}

    public getState = () =>{
        return this.state;
    }

    private setState = (param: {[key:string]:any } | StateCallback) => {   
        let newState = {};
        if(typeof param === 'function') {
            newState = param(this.state)
          }
          else {
            newState = param; // use passed object
        }
        this.state = {...this.state, ...newState};
        this.buildUrl();
    }

    public add = (route: RouteDefinition) => {
        this.setState({
            routes: [...this.state.routes, route]
        })
    }

    public go:Go = (route, params, options) =>{        
        if(this.checkRouteExists){
            const {replace, ...restOptions} = options;
            this.setState({
                route: {...route, meta: {...restOptions}},

            })
            this.buildUrl();
        }
    }
    
    public back = () =>{
        window.history.back;
    }
};