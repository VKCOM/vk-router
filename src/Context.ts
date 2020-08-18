import React from "react";
import { NavigatorState } from './Navigator';

export const NavigatorContext = React.createContext<Partial<NavigatorState>>({});
