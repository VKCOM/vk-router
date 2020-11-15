import React from 'react';
import { NavigatorState } from '../types';
import { NavigatorContext } from '../Context';

export type WithNavigator = NavigatorState;

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
