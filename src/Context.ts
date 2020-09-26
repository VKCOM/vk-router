import React from "react";
import { NavigatorState } from './types';

export const NavigatorContext = React.createContext<Partial<NavigatorState>>({});
