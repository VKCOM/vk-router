import React from 'react';   
import { createNavigator, NavigatorState, CreateNavigatorOptions as NavigatorProps} from './Navigator';
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

  private readonly onNavigatorChange = (state: NavigatorState) => {  
    this.setState({...state});
  };
     
  public render() {
    return <NavigatorContext.Provider value={ this.state }>
      { this.props.children }
    </NavigatorContext.Provider>;
  }
}



