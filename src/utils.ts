export const getTarget = (path: string) =>
  path ? path.split(".").reverse()[0] : "";

export const isObject = (obj: any) =>
  (typeof obj === "object" || typeof obj === "function") && obj !== null;

export const set = (obj: Record<string, any>, path: string, value: any) => {
  const pList = Array.isArray(path) ? path : path ? path.split(".") : [];
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
  const processedString =
    path && path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  if (!processedString.length) {
    return decodedQueryString;
  }
  const queryStringPieces = processedString ? processedString.split("&") : [];

  for (const piece of queryStringPieces) {
    let [key, value] = piece.split("=");
    value = value || "";
    set(decodedQueryString, key, value);
  }

  return decodedQueryString;
};

export const getUrlParams = (url: string) => {
  const decodedQueryString: Record<string, any> = {};
  const processedString = url.slice(url.indexOf("?") + 1);
  if (!processedString.length) {
    return decodedQueryString;
  }
  const queryStringPieces = processedString ? processedString.split("&") : [];

  for (const piece of queryStringPieces) {
    let [key, value] = piece.split("=");
    value = value || "";

    set(decodedQueryString, key, value);
  }

  return decodedQueryString;
};

export const buildQueryParams = (
  queryObj: Record<string, any> | string,
  nested: string = ""
) => {
  if (!queryObj || typeof queryObj !== "object") {
    return "";
  }

  const pairs: any[] = Object.entries(queryObj)
    .map(([key, val]) => {
      if (typeof val === "object") {
        return buildQueryParams(val, nested + `${key}.`);
      } else {
        return [nested + key, val].map(escape).join("=");
      }
    })
    .filter((el) => el);
  return pairs.join("&");
};

// TODO
export const buildUrlParams = (
  queryObj: Record<string, any> | string,
  nested: string = ""
) => {
  if (!queryObj || typeof queryObj !== "object") {
    return "";
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

export const buildPathFromDotPath = (path: string) =>
  path ? "/" + path.split(".").join("/") : "";

export const urlToPath = (url: string, options: any) => {
  const match = url.match(/^(?:http|https):\/\/(?:[0-9a-z_\-.:]+?)(?=\/)(.*)$/);
  const path = match ? match[1] : url;

  const pathParts = path.match(/^(.+?)(#.+?)?(\?.+)?$/);

  if (!pathParts) throw new Error(`[router5] Could not parse url ${url}`);

  const pathname = pathParts[1];
  const hash = pathParts[2] || "";
  const search = pathParts[3] || "";

  return (
    (options.useHash
      ? hash.replace(new RegExp("^#" + options.hashPrefix), "")
      : options.base
      ? pathname.replace(new RegExp("^" + options.base), "")
      : pathname) + search
  );
};

export const deepEqual = (object1: any, object2: any, strictValueCompare:boolean = false) => {
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