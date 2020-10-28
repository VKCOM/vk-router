import { Browser } from "./types";
import { get } from './utils';
const value = (arg: any) => () => arg;
const noop = () => {};

const isBrowser = typeof window !== "undefined" && window.history;

const getBase = () => window.location.pathname;

const supportsPopStateOnHashChange = () =>
  window.navigator.userAgent.indexOf("Trident") === -1;

const pushState = (state: any, title: string, path: string) =>
  window.history.pushState(state, title, path);

const replaceState = (state: any, title: any, path: any) =>
  window.history.replaceState(state, title, path);

export const merge = (object: Record<string, any>, other: Record<string, any>) => {
  const merged: Record<string, any> = {};
  Object.keys(object || []).forEach((key: string) => {
    merged[key] = object[key];
  });
  Object.keys(other || []).forEach((key: string) => {
    merged[key] = object[key];
  });

  return merged;
};

const which = (e: any) => {
  e = e || window.event;
  return null === e.which ? e.button : e.which;
}

const onLinkListener = (navigator: any, opts: any) => (e: any) => {
  // console.log('listener', e);
  if (1 !== which(e)) return;
  
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  if (e.defaultPrevented) return;

  // ensure link
  let el = e.target;
  while (el && "A" !== el.nodeName) el = el.parentNode;
  if (!el || "A" !== el.nodeName) return;
  
  if (el.hasAttribute("download") || el.getAttribute("rel") === "external")
    return;

  // check target
  if (el.target) return;
  if (!el.href) return;

  const toRouteState = navigator.buildState(el.href);
  // console.log('goTo', toRouteState);
  if (toRouteState) {
    e.preventDefault();
    const routeName = toRouteState.page || toRouteState.modal;
    const params = toRouteState.params[routeName] || {};
    navigator.go(routeName, params);
  }
};

const addLinkInterceptorListener = (navigator: Navigator, opts?: any) => {
  const clickEvent = document.ontouchstart ? "touchstart" : "click";
  const clickHandler = onLinkListener(navigator, opts);
  document.addEventListener(clickEvent, clickHandler, false);

  return () => {
    window.removeEventListener(clickEvent, clickHandler);
  };
};

const addPopstateListener = (fn: any, opts: any) => {
  const shouldAddHashChangeListener =
    opts.useHash && !supportsPopStateOnHashChange();

  window.addEventListener("popstate", fn);

  if (shouldAddHashChangeListener) {
    window.addEventListener("hashchange", fn);
  }

  return () => {
    window.removeEventListener("popstate", fn);

    if (shouldAddHashChangeListener) {
      window.removeEventListener("hashchange", fn);
    }
  };
};

const safelyEncodePath = (path: any) => {
  try {
    return encodeURI(decodeURI(path));
  } catch (_) {
    return path;
  }
};

const getLocation = (opts: any) => {
  const path = opts.useHash
    ? window.location.hash.replace(new RegExp("^#" + opts.hashPrefix), "")
    : window.location.pathname.replace(new RegExp("^" + opts.base), "");

  const correctedPath = safelyEncodePath(path);
  return (correctedPath || "/") + window.location.search;
};

const getState = () => window.history.state;

const getHash = () => window.location.hash;

let browser = {};
if (isBrowser) {
  browser = {
    getBase,
    pushState,
    replaceState,
    addPopstateListener,
    addLinkInterceptorListener,
    getLocation,
    getState,
    getHash,
  };
} else {
  browser = {
    getBase: value(""),
    pushState: noop,
    replaceState: noop,
    addPopstateListener: noop,
    getLocation: value(""),
    getState: value(null),
    getHash: value(""),
  };
}

export default browser as Browser;
