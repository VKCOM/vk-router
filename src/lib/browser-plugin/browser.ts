import { Browser } from './types'
import { getUrlParams, buildUrlParams, buildPathFromDotPath } from './utils';
const value = (arg: any) => () => arg
const noop = () => {}

const isBrowser = typeof window !== 'undefined' && window.history

const getBase = () => window.location.pathname

const supportsPopStateOnHashChange = () =>
    window.navigator.userAgent.indexOf('Trident') === -1

const pushState = (state: any, title: string, path: string) =>
    window.history.pushState(state, title, path)

const replaceState = (state:any, title:any, path:any) =>
    window.history.replaceState(state, title, path)

const addPopstateListener = (fn: any, opts: any) => {
    const shouldAddHashChangeListener =
        opts.useHash && !supportsPopStateOnHashChange()

    window.addEventListener('popstate', fn)

    if (shouldAddHashChangeListener) {
        window.addEventListener('hashchange', fn)
    }

    return () => {
        window.removeEventListener('popstate', fn)

        if (shouldAddHashChangeListener) {
            window.removeEventListener('hashchange', fn)
        }
    }
}

const getLocation = (opts: any) => {
    const path = opts.useHash
        ? window.location.hash.replace(new RegExp('^#' + opts.hashPrefix), '')
        : window.location.pathname.replace(new RegExp('^' + opts.base), '')

    // Fix issue with browsers that don't URL encode characters (Edge)
    
    if(opts.useQueryNavigation){
        const { route, subroute, ...queryParams } = getUrlParams(window.location.search);
        const search = subroute 
          ? buildUrlParams({...queryParams, subroute, prevRoute: route }) 
          : buildUrlParams({...queryParams });
          
        const actualPath = subroute || route;
        // Мы фактически на subroute, но в урле сохраняем page
        const correctedPath = safelyEncodePath(buildPathFromDotPath(actualPath));
        return `${(correctedPath || '/')}?${search}`;
    };
    const correctedPath = safelyEncodePath(path);
    return (correctedPath || '/') + window.location.search
}

const safelyEncodePath = (path: any) => {
    try {
        return encodeURI(decodeURI(path))
    } catch (_) {
        return path
    }
}

const getState = () => window.history.state

const getHash = () => window.location.hash

let browser = {}
if (isBrowser) {
    browser = {
        getBase,
        pushState,
        replaceState,
        addPopstateListener,
        getLocation,
        getState,
        getHash
    }
} else {
    browser = {
        getBase: value(''),
        pushState: noop,
        replaceState: noop,
        addPopstateListener: noop,
        getLocation: value(''),
        getState: value(null),
        getHash: value('')
    }
}

export default browser as Browser
