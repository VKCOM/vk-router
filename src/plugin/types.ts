import { State } from 'router5'

export interface BrowserPluginOptions {
    forceDeactivate?: boolean
    useHash?: boolean
    hashPrefix?: string
    base?: string | null
    mergeState?: boolean
    preserveHash?: boolean
    useQueryNavigation?: boolean;
    sourceRoutes?: any[],
    defaultPath?: string,
    subRouteKey?: string,
}

export interface Browser {
    getBase(): string
    pushState(state: HistoryState, title: string | null, path: string): void
    replaceState(state: HistoryState, title: string | null, path: string): void
    addPopstateListener(fn: any, opts: any): any
    getLocation(opts: BrowserPluginOptions): string
    getState(): HistoryState
    getHash(): string
}

export interface HistoryState extends State {
    [key: string]: any
}

export interface CoreParams {
    [key: string]: any,
    route: string;
    subroute?: string;
    routeParams?: {
        route?: {
          [key: string]: any;
        },
        subroute?: {
          [key: string]: any;
        }
    }
}

export interface HistoryRecord extends CoreParams {
}

export interface URLParamsCollection {
    [key: string]: any
}
