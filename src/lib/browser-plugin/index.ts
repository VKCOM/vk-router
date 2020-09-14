import { PluginFactory, errorCodes, constants, Router, State } from 'router5'
import safeBrowser from './browser'
import { BrowserPluginOptions } from './types'
import { buildUrlParams, getUrlParams } from './utils';

declare module 'router5/dist/types/router' {
    interface Router {
        disableUrlUpdate:(value: boolean) => void
        buildUrl(name: string, params?: { [key: string]: any }): string
        matchUrl(url: string): State | null
        buildQueryUrl(name: string, params?: { [key: string]: any }): string,
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
}

const source = 'popstate'

function browserPluginFactory(
    opts?: BrowserPluginOptions,
    browser = safeBrowser
): PluginFactory {
    const options: BrowserPluginOptions = { ...defaultOptions, ...opts }
    const transitionOptions = {
        forceDeactivate: options.forceDeactivate,
        source
    }
    let removePopStateListener:any
    let disableUrlUpdate = false;

    return function browserPlugin(router: Router) {
        const routerOptions = router.getOptions();
        const routerStart = router.start;

        router.disableUrlUpdate = (value: boolean) => {
            disableUrlUpdate = value;
        };  

        const buildUrl = (route: any, params: any) => {
            const base = options.base || ''
            const prefix = options.useHash ? `#${options.hashPrefix}` : ''
            const path = router.buildPath(route, params);
            return base + prefix + path;
        }
        
        const buildQueryUrl = (route: any, params: any) => {
            const { isSubRoute, prevRoute, subroute, ...routeParams } = params;
            const queryParams = buildUrlParams(routeParams);
            const search = queryParams.length ? `&${queryParams}`: '';
            const url = isSubRoute || subroute
                ?`?route=${prevRoute}&subroute=${route}${search}`
                :`?route=${route}${search}`;
            return url;
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
            const { route, subroute, ...searchData} = getUrlParams(searchPart);
            const search = buildUrlParams(searchData)
            const pathname = pathnamePart + (subroute || route);
            return (
                (options.base
                    ? pathname.replace(new RegExp('^' + options.base), '')
                    : pathname) + search
            )
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
                routerStart(browser.getLocation(options), ...args)
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
            const routerState = router.getState()
            // Do nothing if no state or if last know state is poped state (it should never happen)
            const newState = !evt.state || !evt.state.name
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
                // If current state is already the default route, we will have a double entry
                // Navigating back and forth will emit SAME_STATES error
                defaultRoute &&
                    router.navigateToDefault({
                        ...transitionOptions,
                        reload: true,
                        replace: true
                    })
                return
            }
            if (
                routerState &&
                router.areStatesEqual(state, routerState, false)
            ) {
                return
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
                                // Keep history state unchanged but use current URL
                                updateBrowserState(state, url, true)
                            }
                            // else do nothing or history will be messed up
                            // TODO: history.back()?
                        } else {
                            // Force navigation to default state
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
                // Guess base
                options.base = browser.getBase()
            }

            removePopStateListener = browser.addPopstateListener(
                onPopState,
                options
            )
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
