import React from "react";
import { Router } from "router5/dist/types/router";
import { Go } from './interfaces';

export interface NavigatorContextProps { 
  router?: Partial<Router>
  currentRoute?: any;
  previousRoute?: any;
  options?:any;
  params?: any; 
  history?: Record<string, string[]>;
  go?: Go,
  back?: VoidFunction,
}

export const NavigatorContext = React.createContext<NavigatorContextProps>({});
