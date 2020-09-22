const get = (obj: Record<string, any>, path: string, defaultValue?: any) => (path ? path.split(".") : [])
.reduce((a, c) => (a && a[c] ? a[c] : (defaultValue || null)), obj);

const isObject = (obj: any) => (typeof obj === "object" || typeof obj === 'function') && (obj !== null);

const set = (obj: Record<string, any>, path: string, value: any) => {
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

const has = (obj: any, path: string) => {
    const pList = Array.isArray(path) ? path : path ? path.split('.') : [];
    const len = pList.length;
    let res = true;
    for (let i = 0; i < len - 1; i++) {
        const elem = pList[i];
        if (!obj[elem]) {
            res = false;
            break;
        }
    }
     return res; 
}  

export const __getUrlParams = (url: string) => { 
  const decodedQueryString: Record<string, any> = {};
  const processedString =  url.slice(url.indexOf('?') + 1);
  const queryStringPieces = processedString ? processedString.split("&") : [];
  console.log
  for (const piece of queryStringPieces) {
    let [key, value] = piece ? piece.split("=") : [];
    value = value || "";
    if (has(decodedQueryString, key)) {
      const currentValueForKey = get(decodedQueryString, key);
      if (!Array.isArray(currentValueForKey)) {
        set(decodedQueryString, key, [currentValueForKey, value]);
      } else {
        currentValueForKey.push(value);
      }
    } else {
      set(decodedQueryString, key, value);
    }
  } 
  return decodedQueryString;
}

export const getUrlParams = (url: string, nested = "") => { 
    const decodedQueryString: Record<string, any> = {};
    const processedString =  url.slice(url.indexOf('?') + 1);
    const queryStringPieces = processedString ? processedString.split("&") : [];
  
    for (const piece of queryStringPieces) {
      let [key, value] = piece.split("=");
      value = value || ""; 
      if (key && key.includes('.')) { 
          const [parentKey, childKey] = key.split('.');
          set(decodedQueryString, `routeParams.${parentKey}.${childKey}`, value);
      } else {
        set(decodedQueryString, key, value);
      }
    }
    console.log('routeParams', decodedQueryString);
    return decodedQueryString;
  }

export const _getUrlParams = (url: string) => {
    const hashes = url.slice(url.indexOf('?') + 1).split('&')
    const params: Record<string, any> = {}
    hashes.map(hash => {
        const [key, val] = hash.split('=')
        params[key] = decodeURIComponent(val)
    })
    return params;
}


export const buildUrlParams = (queryObj: Record<string, any> | string, nesting: string = "") => {
    if(!queryObj){
        return '';
    }
    const pairs: any[] = Object.entries(queryObj).map(([key, val]) => {
        if (typeof val === "object") {
          return buildUrlParams(val, nesting + `${key}.`);
        } else {
            return [nesting + key, val].map(escape).join("=");
        }
    });
    return pairs.join("&");
};

export const _buildUrlParams = (params: Record<string, any>) => {
    const esc = encodeURIComponent;
    const query = Object.keys(params)
        .map(k => esc(k) + '=' + esc(params[k]))
        .join('&');
    return query;
};

export const buildPathFromDotPath = (path: string) => path ? '/'+ path.split('.').join('/') : '';