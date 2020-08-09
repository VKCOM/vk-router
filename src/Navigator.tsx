import React from 'react';   
import { createRouterInstance, CreateRouterInstanceOptions } from './Router';
import { NavigatorContextProps, NavigatorContext } from './Context';
import { buildFakeHistory } from './utils';   
import { Go, RouteDefinition } from './interfaces';

export interface NavigatorProps {
  routes: RouteDefinition[],
  config?: CreateRouterInstanceOptions,   
}   
   
export default class Navigator extends React.PureComponent<NavigatorProps> {
  public state: NavigatorContextProps;
  
  public constructor(props: NavigatorProps) {
    super(props);
    const { routes, config } = this.props;
    const router = createRouterInstance({ routes, config });  
    
    router.subscribe(this.onRouteChange);
    router.start();
    
    const currentRoute = router.getState(); 
   
      
    if(window.history.length <= 2){
      const url  = window.location.toString();
      buildFakeHistory(url);
    }

    this.state = {
      currentRoute,
      go: this.go,
      back: this.back, 
    }; 
  }

  private readonly onRouteChange = (newRoute: any, previousRoute:any) => { 
 
    this.setState({
      previousRoute,
      route: newRoute, 
    });
  };
   
  go: Go = (to, params, options) => {
    const { router } = this.state;
    const route = to || router.getState().name;
    router.navigate(route, params, options);
  };
  
  back: VoidFunction = () => {
    window.history.back();
  };
    
  public render() {
    return <NavigatorContext.Provider value={ this.state }>
      { this.props.children }
    </NavigatorContext.Provider>;
  }
}



