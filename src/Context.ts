import React from 'react';

export interface NavigatorContextProps {
    router?: Router;
    previousRoute?: Route;
    activeView?: string;
    activePanels?: any;
    onRootTransition?: (OnTransitionParams) => void;
    onTransition?: (OnTransitionParams) => void;
    history?: Record<string, string[]>;
}
  
export const NavigatorContext = React.createContext<NavigatorContextProps>({});