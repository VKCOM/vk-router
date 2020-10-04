import { URLParamsCollection, NavigatorRoute, NavigatorParams } from './types';

// export const _getUrlParams = (url: string) => {
//     const hashes = url.slice(url.indexOf('?') + 1).split('&');
//     const params: URLParamsCollection = {};
//     hashes.forEach((hash: string) => {
//       const [key, val] = hash.split('=');
//       params[key] = decodeURIComponent(val);
//     })
//     return params;
// }

// export const _buildUrlParams = (params: URLParamsCollection) => {
//     const esc = encodeURIComponent;
//     const query = Object.keys(params)
//       .map(k => esc(k) + '=' + esc(params[k]))
//       .join('&');
//     return query;
// };

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

export const getParentRoute = (path: string): string => {
  const resultArr = path.split('.');
  resultArr.pop();
  return resultArr.length > 1 ? resultArr.join('.') : resultArr[0];
}

export const validateParams = (params: NavigatorParams) => {
  return true;
} 

export const buildPathForRoute = (name: string, params: NavigatorParams) => {
  return `/${name}${buildTokenStringForPath(params)}`;
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
        const { route, subroute, ...queryParams } = getQueryParams(search);
        let pathQuery = '';
        let baseRoute = '';

        if (route) {
          const segments = route.split('.'); 
          const paths = segments.filter((segment: string) => treeIncludes(routes, segment));
          paths.forEach((path: string) => {
            const searchPath = buildQueryParams({
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
            const searchPath = buildQueryParams({
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

export const isObject = (obj: any) => (typeof obj === "object" || typeof obj === 'function') && (obj !== null);

export const set = (obj: Record<string, any>, path: string, value: any) => {
  const pList = Array.isArray(path) ? path : path ? path.split('.') : [];
  const len = pList.length;

  for (let i = 0; i < len - 1; i++) {
    const elem = pList[i];
    if (!obj[elem] || !isObject(obj[elem])) {
      obj[elem] = {} as Record<string, any>;
    }
    obj = obj[elem];
  }

  obj[pList[len - 1]] = value;
};

export const getQueryParams = (path: string) => { 
  const decodedQueryString: Record<string, any> = {};
  const processedString = path && path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  if(!processedString.length){
    return decodedQueryString;
  };
  const queryStringPieces = processedString ? processedString.split("&") : [];
  
  for (const piece of queryStringPieces) {
    let [key, value] = piece.split("=");
    value = value || "";
    set(decodedQueryString, key, value);
  }

  return decodedQueryString;
}

// TODO
export const getUrlParams = (url: string) => { 
  const decodedQueryString: Record<string, any> = {};
  const processedString =  url.slice(url.indexOf('?') + 1);
  if(!processedString.length){
    return decodedQueryString;
  };
  const queryStringPieces = processedString ? processedString.split("&") : [];
  
  for (const piece of queryStringPieces) {
    let [key, value] = piece.split("=");
    value = value || "";
     
    set(decodedQueryString, key, value);
  }

  return decodedQueryString;
}

export const buildQueryParams = (queryObj: Record<string, any> | string, nested: string = "") => {
  if(!queryObj || typeof queryObj !== 'object'){
    return '';
  }

  const pairs: any[] = Object.entries(queryObj).map(([key, val]) => {
      if (typeof val === "object") {
        return buildQueryParams(val, nested + `${key}.`);
      } else {
        return [nested + key, val].map(escape).join("=");
      }
  }).filter(el => el);
  return pairs.join("&");
};

// TODO
export const buildUrlParams = (queryObj: Record<string, any> | string, nested: string = "") => {
  if(!queryObj || typeof queryObj !== 'object'){
    return '';
  }

  const pairs: any[] = Object.entries(queryObj).map(([key, val]) => {
      if (typeof val === "object") {
        return buildQueryParams(val, nested + `${key}.`);
      } else {
        return [nested + key, val].map(escape).join("=");
      }
  });

  return pairs.join("&");
};

export const buildPathFromDotPath = (path: string) => path ? '/'+ path.split('.').join('/') : '';

export const urlToPath = (url: string, options: any) => {
  const match = url.match(
      /^(?:http|https):\/\/(?:[0-9a-z_\-.:]+?)(?=\/)(.*)$/
  )
  const path = match ? match[1] : url;

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
};