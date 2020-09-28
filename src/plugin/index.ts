import { PluginFactory, errorCodes, constants, Router, State, NavigationOptions } from 'router5';
import safeBrowser from './browser';
import { BrowserPluginOptions, CoreParams, HistoryRecord } from './types';
import { buildUrlParams, getUrlParams, restoreParams } from './utils';
import { getRouteData } from '../utils';

declare module 'router5/dist/types/router' {
    interface Router {
        disableUrlUpdate:(value: boolean) => void
        buildUrl(name: string, params?: { [key: string]: any }): string
        matchUrl(url: string): State | null
        buildQueryUrl(name: string, params?: { [key: string]: any }): string,
        go(routeName: string, routeParams: Record<string, any>, options?: any, done?: any): any,
        goBack(): any,      
        sourceRoutes: Record<string, any>[],
        replaceHistoryState(
            name: string,
            params?: { [key: string]: any },
            title?: string
        ): void
        lastKnownState: State
    }
}

const defaultOptions: BrowserPluginOptions = {
    forceDeactivate: true,
    useHash: false,
    hashPrefix: '',
    base: '',
    mergeState: false,
    preserveHash: true,
    useQueryNavigation: false,
    sourceRoutes: [], 
    subRouteKey: 'subRoute',
}

const source = 'popstate';

function browserPluginFactory(
    opts?: BrowserPluginOptions,
    browser = safeBrowser
): PluginFactory {
    const options: BrowserPluginOptions = { ...defaultOptions, ...opts }
    const transitionOptions = {
        forceDeactivate: options.forceDeactivate,
        source
    }
    let removePopStateListener: any;
    let disableUrlUpdate = false;
    let prevRoute: string;
    let prevParams: any;
    const history: HistoryRecord[] = [];

    return function browserPlugin(router: Router) {
        const routerOptions = router.getOptions();
        const routerStart = router.start;
        const routerNavigate = router.navigate;

        router.sourceRoutes = opts.sourceRoutes;
       
        router.disableUrlUpdate = (value: boolean) => {
            disableUrlUpdate = value;
        };  

        router.go = (routeName: string, routeParams: Record<string, any>, options?: NavigationOptions, done?: any) => {
            const currentRoute = router.getState().name;
            const currentParams = (restoreParams(router.getState().params) || {}).routeParams;
            
            const routeData: Record<string,any> = getRouteData(routeName, opts.sourceRoutes);
            const currentRouteData: Record<string,any> = getRouteData(currentRoute, opts.sourceRoutes);

            const isSubRoute = routeData && routeData[opts.subRouteKey || 'subRoute']; 
            const isSubRouteCurrentRoute = currentRouteData && currentRouteData[opts.subRouteKey || 'subRoute'];
            const updateUrl = routeData && routeData.updateUrl;
            
            if (updateUrl === false) {
              router.disableUrlUpdate(true);
            }

            prevRoute = isSubRouteCurrentRoute ? (prevRoute || currentRoute) : currentRoute;
            prevParams = isSubRouteCurrentRoute ? (prevParams || currentParams) : currentParams;
            
            const coreParams: CoreParams = {
              route: routeName      
            };
            
            if (routeParams && Object.keys(routeParams).length) {
              coreParams.routeParams = { route: routeParams };
            }
            
            if (isSubRoute) { 
                coreParams.route = prevRoute;

                if (prevParams && Object.keys(prevParams).length) {
                  coreParams.routeParams = {
                      ...prevParams,
                  };
                }

                coreParams.subroute = routeName;
                  
                if (routeParams && Object.keys(routeParams).length) {
                  coreParams.routeParams = { 
                    ...prevParams,  
                    subroute: routeParams 
                  };
                }
            } 
            const isBack = prevRoute === routeName;
            if(isBack){
                history.pop();
            } else {
                history.push(coreParams)
            }
            return routerNavigate(routeName, coreParams, options, done);
        }
        
        router.goBack = () => {
            if (prevRoute) {
                const prevHistoryState = history[history.length - 1];
                console.log('prevHistoryState', prevHistoryState, prevParams);
              if (prevHistoryState) {
                router.go(prevHistoryState.route, {});
              } else {
                window.history.back();
              }
            } else {
              window.history.back();
            }
        }

        const buildUrl = (route: any, params: Record<string, any>) => {
            const base = options.base || '';
            const prefix = options.useHash ? `#${options.hashPrefix}` : '';
            const path = router.buildPath(route, params);
            return base + prefix + path;
        }
        
        const buildQueryUrl = (_: any, params: any) => {
          const queryParams = buildUrlParams(params);
          const search = queryParams.length ? `${queryParams}`: '';
          return `/?${search}`;
        }

        router.buildUrl = options.useQueryNavigation ? buildQueryUrl : buildUrl;

        const queryUrlToPath = (url: string) => {
            const match = url.match(
                /^(?:http|https):\/\/(?:[0-9a-z_\-.:]+?)(?=\/)(.*)$/
            )
            const path = match ? match[1] : url;

            const pathParts = path.match(/^(.+?)(#.+?)?(\?.+)?$/)

            if (!pathParts)
                throw new Error(`[router5] Could not parse url ${url}`)

            const pathnamePart = pathParts[1] 
            const searchPart = pathParts[3] || ''
            const { route, subroute, routeParams } = getUrlParams(searchPart);
            const search = buildUrlParams({ route, subroute, routeParams });
            const pathname = pathnamePart + (subroute || route);
            const urlPath = (options.base
                ? pathname.replace(new RegExp('^' + options.base), '')
                : pathname) + `?${search}`; 
            return urlPath;
        }

        const urlToPath = (url: string) => {
            const match = url.match(
                /^(?:http|https):\/\/(?:[0-9a-z_\-.:]+?)(?=\/)(.*)$/
            )
            const path = match ? match[1] : url

            const pathParts = path.match(/^(.+?)(#.+?)?(\?.+)?$/)

            if (!pathParts)
                throw new Error(`[router5] Could not parse url ${url}`)

            const pathname = pathParts[1]
            const hash = pathParts[2] || ''
            const search = pathParts[3] || ''

            return (
                (options.useHash
                    ? hash.replace(new RegExp('^#' + options.hashPrefix), '')
                    : options.base
                    ? pathname.replace(new RegExp('^' + options.base), '')
                    : pathname) + search
            )
        }

        const currentUrl = (url: any) => options.useQueryNavigation ? queryUrlToPath(url) : urlToPath(url);

        router.matchUrl = (url: any) => router.matchPath(currentUrl(url))

        router.start = function(...args: any) {
          if (args.length === 0 || typeof args[0] === 'function') {
            routerStart(browser.getLocation(options), ...args);
          } else {
            routerStart(...args)
          }

          return router
        }

        router.replaceHistoryState = function(name: any, params = {}, title = '') {
            const route = router.buildState(name, params)
            const state = router.makeState(
                route.name,
                route.params,
                router.buildPath(route.name, route.params),
                { params: route.meta }
            )
            const url = router.buildUrl(name, params)
            router.lastKnownState = state
            browser.replaceState(state, title, url)
        }

        function updateBrowserState(state: any, url: any, replace: any) {
            const trimmedState = state
                ? {
                      meta: state.meta,
                      name: state.name,
                      params: state.params,
                      path: state.path
                  }
                : state
            const finalState =
                options.mergeState === true
                    ? { ...browser.getState(), ...trimmedState }
                    : trimmedState

            if (replace) browser.replaceState(finalState, '', url)
            else browser.pushState(finalState, '', url)
        }

        function onPopState(evt: PopStateEvent) {
            const routerState = router.getState();
            const newState = !evt.state || !evt.state.name;
            const state = newState
                ? router.matchPath(browser.getLocation(options), source)
                : router.makeState(
                      evt.state.name,
                      evt.state.params,
                      evt.state.path,
                      { ...evt.state.meta, source },
                      evt.state.meta.id
                  )
            const { defaultRoute, defaultParams } = routerOptions

            if (!state) {
                defaultRoute &&
                    router.navigateToDefault({
                        ...transitionOptions,
                        reload: true,
                        replace: true
                    })
                return;
            }
            if (
                routerState &&
                router.areStatesEqual(state, routerState, false)
            ) {
                return;
            }

            router.transitionToState(
                state,
                routerState,
                transitionOptions,
                (err, toState) => {
                    if (err) {
                        if (err.redirect) {
                            const { name, params } = err.redirect

                            router.navigate(name, params, {
                                ...transitionOptions,
                                replace: true,
                                force: true,
                                redirected: true
                            })
                        } else if (err.code === errorCodes.CANNOT_DEACTIVATE) {
                            const url = router.buildUrl(
                                routerState.name,
                                routerState.params
                            )
                            if (!newState) {
                                if(disableUrlUpdate){
                                    router.disableUrlUpdate(false);
                                } else {
                                    updateBrowserState(state, url, true) 
                                }
                            }
                        } else {
                            defaultRoute &&
                                router.navigate(defaultRoute, defaultParams, {
                                    ...transitionOptions,
                                    reload: true,
                                    replace: true
                                })
                        }
                    } else {
                        router.invokeEventListeners(
                            constants.TRANSITION_SUCCESS,
                            toState,
                            routerState,
                            { replace: true }
                        )
                    }
                }
            )
        }

        function onStart() {
            if (options.useHash && !options.base) {
                options.base = browser.getBase();
            }

            removePopStateListener = browser.addPopstateListener(
                onPopState,
                options
            );
        }

        function teardown() {
            if (removePopStateListener) {
                removePopStateListener()
                removePopStateListener = undefined
            }
        }

        function onTransitionSuccess(toState: any, fromState: any, opts: any) {
            const historyState = browser.getState()
            const hasState =
                historyState &&
                historyState.meta &&
                historyState.name &&
                historyState.params
            const statesAreEqual =
                fromState && router.areStatesEqual(fromState, toState, false)
            const replace = opts.replace || !hasState || statesAreEqual
            let url = router.buildUrl(toState.name, toState.params)
            if (
                fromState === null &&
                options.useHash === false &&
                options.preserveHash === true
            ) {
                url += browser.getHash()
            }
            if(disableUrlUpdate){
                router.disableUrlUpdate(false);
            } else {
                updateBrowserState(toState, url, replace) 
            }
        }

        return {
            onStart,
            onStop: teardown,
            teardown,
            onTransitionSuccess,
            onPopState
        }
    }
}

export default browserPluginFactory
