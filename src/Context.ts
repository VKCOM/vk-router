import React from "react";
import { Router } from "router5/dist/types/router";
import { Go } from './interfaces';

export interface NavigatorContextProps {
  [key:string]: any,
  router?: Partial<Router>
  previousRoute?: string;
  options?:any;
  params?: any; 
  history?: Record<string, string[]>;
  go?: Go,
  back?: VoidFunction,
}

export const NavigatorContext = React.createContext<NavigatorContextProps>({});
