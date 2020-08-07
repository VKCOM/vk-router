import React from "react";
import { Router } from "router5/dist/types/router";
import { OnTransitionParams, Go } from './interfaces';
export interface NavigatorContextProps {
  [key:string]: any,
  router?: Partial<Router>
  previousRoute?: string;
  activeView?: string;
  activePanels?: { [key:string]: string };
  activeModals?: string[];
  params?: any,
  onRootTransition?: (onTransitionParams: OnTransitionParams) => void;
  onTransition?: (onTransitionParams: OnTransitionParams) => void;
  history?: Record<string, string[]>;
  go?: Go
}

export const NavigatorContext = React.createContext<NavigatorContextProps>({});
