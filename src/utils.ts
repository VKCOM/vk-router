import { State } from 'router5/dist/types/base';

export function buildPanelID(view: string, panel: string): string {
  return `${view}_${panel}`;
}

export const isClient = (): boolean =>
  typeof window === "object" && window !== null;

export const getPanelData = (panelName: string, routes: any[]) =>
  routes.find((route) => route.name === panelName);

export function getRouteData(routeState: State, routes: any[], panelsOrder:any) {
  const view = findPanelView(routeState.name, panelsOrder);
  const config = routes.find(({ name }) => name === routeState.name);

  return {
    isIntermediate: config?.intermediate ?? false,
    isModal: config?.modal ?? false,
    name: routeState.name,
    view,
  };
}
export const findPanelView = (panelId: string, panelsOrder:any) =>
  Object.keys(panelsOrder).find((viewName) => {
    return panelsOrder[viewName].includes(panelId);
  });

export const buildFakeHistory = (url: string) => {
  const { origin, pathname } = new URL(url);
  const paths:string[] = pathname.split('/').filter(path => path);
  let pathstring = '';
  paths.forEach(path=>{
      pathstring+=`/${path}`;
      const url = `${origin}${pathstring}`;
      history.pushState({}, path, url);
      return url;
  });
};