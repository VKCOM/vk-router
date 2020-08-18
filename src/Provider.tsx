import React from 'react';   
import { createNavigator, NavigatorState, CreateNavigatorOptions as NavigatorProps, NavigatorStatesToSubscriber } from './Navigator';
import { NavigatorContext } from './Context';
 
export default class Provider extends React.PureComponent<NavigatorProps> {
  public state: NavigatorState;
  
  public constructor(props: NavigatorProps) {
    super(props);
    const { routes, config } = this.props;
    const navigator = createNavigator({ routes, config });  
    const initialState = navigator.getState();
    navigator.subscribe(this.onNavigatorChange);
    navigator.start(); 
    this.state = {...initialState};
  }

  private readonly onNavigatorChange = ({ toState }: NavigatorStatesToSubscriber) => {  
    console.log('onNavigatorChange:::', toState);
    this.setState({...toState});
  };
     
  public render() {
    return <NavigatorContext.Provider value={ this.state }>
      { this.props.children }
    </NavigatorContext.Provider>;
  }
}



