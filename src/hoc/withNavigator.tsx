import React from 'react';

import { NavigatorContext, NavigatorContextProps} from '../Context';
 
export interface WithNavigator extends NavigatorContextProps{
}; 

export function withNavigator<T>(Component: React.ComponentType<T>) { 
    return class _Navigator extends React.PureComponent {
      public static contextType = NavigatorContext;
  
      public render() {
        const props = {
          ...this.props,
          ...this.context,
        };
  
        return (
          <Component { ...props } />);
      }
    };
  }
  