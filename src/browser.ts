/**
 * Интерфейс для взаимодействия с api браузера
 */
import { Browser } from "./types";

const getBase = () => window.location.pathname;

const supportsPopStateOnHashChange = () =>
  window.navigator.userAgent.indexOf("Trident") === -1;

const pushState = (state: any, title: string, path: string) =>
  window.history.pushState(state, title, path);

const replaceState = (state: any, title: any, path: any) =>
  window.history.replaceState(state, title, path);

const which = (e: any) => {
  e = e || window.event;
  return null === e.which ? e.button : e.which;
};

const isExternal = (url: string) => {
  const domain = (url: string) =>
    url.replace("http://", "").replace("https://", "").split("/")[0];

  return domain(window.location.href) !== domain(url);
};

const onLinkListener = function (buildState: any, go: any) {
  return (e: any) => {
    if (1 !== which(e)) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;

    let el = e.target;
    while (el && "A" !== el.nodeName && "BUTTON" !== el.nodeName)
      el = el.parentNode;
    if (!el || "A" !== el.nodeName) return;

    if (
      el.hasAttribute("download") ||
      el.getAttribute("rel") === "external" ||
      isExternal(el.href)
    )
      return;

    if (el.target) return;
    if (!el.href) return;

    const toRouteState = buildState(el.href);

    if (toRouteState) {
      e.preventDefault();
      const routeName = toRouteState.modal || toRouteState.page;
      const params = toRouteState.params || {};
      go(routeName, params);
    }
  };
};

const addLinkInterceptorListener = (buildState: any, go: any) => {
  const clickEvent = document.ontouchstart ? "touchstart" : "click";
  const clickHandler = onLinkListener(buildState, go);
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

const getLocation = (opts: any, search: any) => {
  const path = opts.preserveHash 
    ? window.location.pathname.replace(new RegExp("^"), "") 
    : window.location.hash.replace(new RegExp("^#"), "");

  const correctedPath = safelyEncodePath(path);
  return (correctedPath || "/") + (search || window.location.search);
};

const getState = () => window.history.state;

const getHash = () => window.location.hash;

const browser = {
  getBase,
  pushState,
  replaceState,
  addPopstateListener,
  addLinkInterceptorListener,
  getLocation,
  getState,
  getHash,
};

export default browser as Browser;
