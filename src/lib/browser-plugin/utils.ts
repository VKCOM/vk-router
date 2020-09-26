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

export const getUrlParams = (url: string) => { 
  const decodedQueryString: Record<string, any> = {};
  const processedString =  url.slice(url.indexOf('?') + 1);
  const queryStringPieces = processedString ? processedString.split("&") : [];
  
  for (const piece of queryStringPieces) {
    let [key, value] = piece.split("=");
    value = value || ""; 
    set(decodedQueryString, key, value);
  }

  return decodedQueryString;
}

export const restoreParams = (params: Record<string, any>) => {
    if(!params || typeof params !== 'object'){
      return '';
    }
    const restoredParams: Record<string, any> = {};
    for (const [keyOrPath, value] of Object.entries(params)) {
      set(restoredParams, keyOrPath, value);
    }
    return restoredParams;
}

export const buildUrlParams = (queryObj: Record<string, any> | string, nested: string = "") => {
    if(!queryObj || typeof queryObj !== 'object'){
      return '';
    }

    const pairs: any[] = Object.entries(queryObj).map(([key, val]) => {
        if (typeof val === "object") {
          return buildUrlParams(val, nested + `${key}.`);
        } else {
          return [nested + key, val].map(escape).join("=");
        }
    });

    return pairs.join("&");
};

export const buildPathFromDotPath = (path: string) => path ? '/'+ path.split('.').join('/') : '';