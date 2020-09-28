import { URLParamsCollection, NavigatorRoute, NavigatorParams } from './types';
import { ERROR_INVALID_PARAMS } from './constants';
import { CoreRoute } from './RouterCore';  

export const getUrlParams = (url: string) => {
    const hashes = url.slice(url.indexOf('?') + 1).split('&');
    const params: URLParamsCollection = {};
    hashes.forEach((hash: string) => {
      const [key, val] = hash.split('=');
      params[key] = decodeURIComponent(val);
    })
    return params;
}

export const buildUrlParams = (params: URLParamsCollection) => {
    const esc = encodeURIComponent;
    const query = Object.keys(params)
      .map(k => esc(k) + '=' + esc(params[k]))
      .join('&');
    return query;
};

const buildTokenStringForPath = (params: URLParamsCollection) => {
    const esc = encodeURIComponent;
    const query = Object.keys(params)
      .map(k => esc(k))
      .join('&');
    if(query && query.length){
      return `?${query}`;
    }
    
    return '';
};

export const getTarget = (path: string) => path ? path.split('.').reverse()[0] : '';

export const getRouteData = (path:string, routes: NavigatorRoute[]): NavigatorRoute | null => {
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
            pathSegmentIndex += 1;
            lookForSegment(route.children);
          }
          break;
        }
      };
    };

    lookForSegment(routes);

    return routeData;
}

export const iterateRouteTree = (routes:NavigatorRoute[], callback: (el:NavigatorRoute, index: number) => any) => {
  if(Array.isArray(routes)){
    routes.forEach((el, index) => {
      callback(el, index)
      if (Array.isArray(el.children)) {
        iterateRouteTree(el.children, callback);
      }
    })
  }
} 

export const checkSubroute = (to: string, routes: NavigatorRoute[], subrouteKey: string) => {
    let result = false;
    const target = getTarget(to); 
    const callback = (route :NavigatorRoute) => { 
      if(route.name === target && route[subrouteKey]){
        result = true;
      }
    };
    iterateRouteTree(routes, callback);
    return result;
};

export const getParentRoute = (path: string): string => {
  const resultArr = path.split('.');
  resultArr.pop();
  return resultArr.length > 1 ? resultArr.join('.') : resultArr[0];
}

export const validateParams = (params: NavigatorParams) => {
    return true;
  } 

export const buildPathForRoute = (name: string, params: NavigatorParams) => {
  if(!validateParams(params)){
    throw new Error(ERROR_INVALID_PARAMS);
  }
  return `/${name}${buildTokenStringForPath(params)}`;
}

export const proccessRoutes = (routes: NavigatorRoute[]): CoreRoute[] => {   
  iterateRouteTree(routes, (route:NavigatorRoute) =>{
    const { name, params = {}, path: routePath } = route;
    const path = routePath || buildPathForRoute(name, params);  
    route.path = path;
  });
  return routes as CoreRoute[];
}

export const treeIncludes = (routes: NavigatorRoute[], name: string) => {
  let result = false;
  iterateRouteTree(routes, (route :NavigatorRoute) => { 
    if (route.name === name) {
      result = true;
    }
  });
  return result;
};

export const buildFakeHistory = (config: NavigatorParams, routes: NavigatorRoute[]) => { 
    const browserHistory = window.history; 
    if (browserHistory.length <= 2) { 
      const { origin, hash, pathname, search } = window.location; 
      
      if (config.useQueryNavigation) {
        const { route, subroute, ...queryParams } = getUrlParams(search);
        let pathQuery = '';
        let baseRoute = '';

        if (route) {
          const segments = route.split('.'); 
          const paths = segments.filter((segment: string) => treeIncludes(routes, segment));
          paths.forEach((path: string) => {
            const searchPath = buildUrlParams({
              route: pathQuery += (pathQuery.length ? `.${path}`: path),
              ...queryParams
            })
            baseRoute = `${origin}/?${searchPath}`;       
            browserHistory.pushState(null, null, baseRoute);
          });
        }

        if (subroute) {
          const segments = route.split('.');
          const paths = segments.filter((segment: string) => treeIncludes(routes, segment));
          
          let subPathQuery = '';

          paths.forEach((subpath: string) => {
            const searchPath = buildUrlParams({
              subroute: subPathQuery += (subPathQuery.length ? `.${subpath}`: subpath),
              ...queryParams
            })
            const url = `${baseRoute}&${searchPath}`;
            browserHistory.pushState(null, null, url);
          });
        }
       
      } else {
        const hashMode = !!hash;
        const address = hashMode ? hash.replace('#', '') : pathname; 
        const paths = address.split('/').filter((path: string) => path);
        let pathstr = hashMode ? '#': ''; 
        paths.forEach((path: string) => {  
            pathstr += `/${path}`;      
            browserHistory.pushState(null, null, `${origin}${pathstr}`);
        });
      }  
    }
  }

export const getRouteParams = ({ routeParams }: NavigatorParams = {}) => routeParams || {};