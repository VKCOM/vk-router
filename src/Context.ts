import React from "react";
import { Route } from "router5";
import { OnTransitionParams } from './interfaces';
export interface NavigatorContextProps {
  [key: string]: any;
  router?: any;
  previousRoute?: Route;
  activeView?: string;
  activePanels?: any;
  activeModals?: any;
  onRootTransition?: (OnTransitionParams: OnTransitionParams) => void;
  onTransition?: (OnTransitionParams: OnTransitionParams) => void;
  history?: Record<string, string[]>;
}

export const NavigatorContext = React.createContext<NavigatorContextProps>({});
