import React from 'react';
import { Route } from 'router5';
 
export interface NavigatorContextProps {
    [key:string]: any,
    router?: any;
    previousRoute?: Route;
    activeView?: string;
    activePanels?: any;
    onRootTransition?: (OnTransitionParams:any) => void;
    onTransition?: (OnTransitionParams:any) => void;
    history?: Record<string, string[]>;
}
  
export const NavigatorContext = React.createContext<NavigatorContextProps>({});