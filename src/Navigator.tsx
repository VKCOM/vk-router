import React from 'react';   
import { createRouterInstance, CreateRouterInstanceOptions } from './Router';
import { NavigatorContextProps, NavigatorContext } from './Context';
import { buildFakeHistory } from './utils';   
import { Go } from './interfaces'; 
import { Route } from 'router5';

export interface NavigatorProps {
  routes: Route[],
  config?: any,   
}   
   
export default class Navigator extends React.PureComponent<NavigatorProps> {
  public state: NavigatorContextProps;
  
  public constructor(props: NavigatorProps) {
    super(props);
    const { routes, config } = this.props;
    
    const options:CreateRouterInstanceOptions = {
      routes, config
    }

    const router = createRouterInstance(options);  
    router.addListener(this.onRouteChange);
    router.start();
    
    const currentRoute = router.getState(); 
    const { onTransition, name, params} = currentRoute;
    const history = {};
    
    if (currentRoute.modal) {
      window.history.back();
    } 

    this.state = {
      router,
      route: name, 
      go: this.go,
      back: this.back,
      close: this.close,  
      onTransition,
      history,
      params,  
    };
 
  }

  private readonly onRouteChange = (newRoute: any, previousRoute:any) => { 
    const { only_page, ...routeParams } = newRoute.params;
    const params = { ...this.state.params, [newRoute.name]: routeParams };
     

    this.setState({
      previousRoute,
      route: newRoute,
      params,
      history,
    }, ()=>{
      if(!this.state.previousRoute){
        const url  = window.location.toString();
        buildFakeHistory(url);
      }
    });
  };
   
  go: Go = (to, params, options) => {
    const { router } = this.state;
    const route = to || router.getState().name;
    router.navigate(route, params, options);
  };

  close: VoidFunction = () => {
    const { close } = this.props;
    if(close){
      close();
    }
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



