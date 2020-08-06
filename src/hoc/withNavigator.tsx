import React from 'react';

import { NavigatorContext } from '../Context';

export function withNavigator(Component:any) { 
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
  