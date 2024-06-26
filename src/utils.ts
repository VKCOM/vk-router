import { NavigatorConfig } from './types';

export const getTarget = (path: string) =>
  path ? path.split('.').reverse()[0] : '';

export const isObject = (obj: any) =>
  (typeof obj === 'object' || typeof obj === 'function') && obj !== null;

export const get = (obj: any, path: string, def: any = undefined) => {
  const everyFunc = (step: string) => {
    return !(step && (obj = obj[step]) === undefined);
  };

  const fullPath = path
    .replace(/\[/g, '.')
    .replace(/]/g, '')
    .split('.')
    .filter(Boolean);

  return fullPath.every(everyFunc) ? obj : def;
};

export const set = (obj: Record<string, any>, path: string, value: any) => {
  const pList = Array.isArray(path) ? path : path ? path.split('.') : [];
  const len = pList.length;

  for (let i = 0; i < len - 1; i++) {
    const elem = pList[i];
    if (!obj[elem] || !isObject(obj[elem])) {
      obj[elem] = Object.create(null) as Record<string, any>;
    }
    obj = obj[elem];
  }

  obj[pList[len - 1]] = value;
};

export const getQueryParams = (path: string) => {
  const decodedQueryString: Record<string, any> = Object.create(null);
  const processedString =
    path && path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';

  if (!processedString.length) {
    return decodedQueryString;
  }

  const queryStringPieces = processedString ? processedString.split(/[&?]/g) : [];

  for (const piece of queryStringPieces) {
    const entry = piece.match(/^([^=]+)(?:=([\s\S]*))?/);
    if (entry) {
      const key = decodeURIComponent(entry[1]);
      if (key.includes('__proto__')) {
        return;
      }
      const value = decodeURIComponent(entry[2]);
      if (key.includes('.')) {
        const segments = key.split('.');
        const paramName = segments.pop();
        const nodeKey = segments.join('.');
        decodedQueryString[nodeKey] = decodedQueryString[nodeKey] || Object.create(null);
        decodedQueryString[nodeKey][paramName] = value;
      }
      decodedQueryString[key] = value;
    }
  }

  return decodedQueryString;
};

export const buildQueryParams = (
  queryObj: Record<string, any> | string,
  nested = '',
  config?: NavigatorConfig
) => {
  if (!queryObj || typeof queryObj !== 'object') {
    return '';
  }
  const escapeFn = config.escape || escape;

  const pairs: any[] = Object.entries(queryObj)
    .filter(([, val]) => !!val)
    .map(([key, val]) => {
      if (typeof val === 'object') {
        return buildQueryParams(val, nested + `${key}.`, config);
      } else {
        if (config?.escapeParams) {
          return [nested + key, val].map(escapeFn).join('=');
        } else {
          return [nested + key, val].join('=');
        }
      }
    })
    .filter((el) => el);
  return pairs.join('&');
};

export const buildPathFromDotPath = (path: string) =>
  path ? '/' + path.split('.').join('/') : '';

export const urlToPath = (url: string, opts: any) => {
  const { useHash, hashPrefix = '', base = '' } = opts;
  const match = url.match(/^(?:http|https):\/\/(?:[0-9a-z_\-.:]+?)(?=\/)(.*)$/);
  const path = match ? match[1] : url;

  const pathParts = path.match(/^(.+?)(#.+?)?(\?.+)?$/);

  if (!pathParts) {return '';}

  const pathname = pathParts[1];
  const hash = pathParts[2] || '';
  const search = pathParts[3] || '';

  return decodeURI(
    (useHash
      ? hash.replace(new RegExp('^#' + String(hashPrefix)), '')
      : base
        ? pathname.replace(new RegExp('^' + String(base)), '')
        : pathname) + search
  );
};

export const hasProperties = (
  object1: any,
  object2: any,
  strictValueCompare = false
) => {
  if (!object1 || !object2) {
    return false;
  }
  const keys2 = Object.keys(object2);

  for (const key of keys2) {
    const val1 = object1[key];
    const val2 = object2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (
      (areObjects && !hasProperties(val1, val2)) ||
      (!areObjects && (strictValueCompare ? val1 !== val2 : val1 != val2))
    ) {
      return false;
    }
  }

  return true;
};

export const deepEqual = (
  object1: any,
  object2: any,
  strictValueCompare = true
) => {
  if (!object1 || !object2) {
    return false;
  }
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    const val1 = object1[key];
    const val2 = object2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (
      (areObjects && !deepEqual(val1, val2)) ||
      (!areObjects && (strictValueCompare ? val1 !== val2 : val1 != val2))
    ) {
      return false;
    }
  }

  return true;
};

export const isChildRoute = (route: string) => route.includes('.');

export const cleanFields = (
  keys: string[],
  paramsPool: Record<string, any>
) => {
  const params: Record<string, any> = Object.create(null);
  while (keys.length) {
    const key = keys.shift();
    params[key] = paramsPool[key];
  }
  return params;
};

export const uniqueBrowserSessionId = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);
