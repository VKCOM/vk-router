import React from 'react';   
import { createRouterInstance, CreateRouterInstanceOptions } from './Router';
import { NavigatorContextProps, NavigatorContext } from './Context';
import { getPanelData, getRouteData, buildFakeHistory } from './utils';   
import { OnTransitionParams, Go } from './interfaces'; 
import { Route } from 'router5';

export interface NavigatorProps {
  routes: Route[]
  panels?: string[],
  modals?: string[], 
  config?: any,  
  panelsOrder?: { [key:string]: string[] }
}   
   
export default class Navigator extends React.PureComponent<NavigatorProps> {
  public state: NavigatorContextProps;
  
  public constructor(props: NavigatorProps) {
    super(props);
    const { routes, modals, panels, panelsOrder, config } = this.props;
    
    const options:CreateRouterInstanceOptions = {
      routes, modals, panels, panelsOrder, config
    }

    const router = createRouterInstance(options);  
    router.addListener(this.onRouteChange);
    router.start();
    
    const currentRoute = router.getState();
    const currentPanel = getPanelData(currentRoute.name, routes);
      
    const routeData = getRouteData(router.getState(), routes, panelsOrder);
    
    if (routeData.isModal) {
      window.history.back();
    }

    this.state = {
      router,
      go: this.go,
      back: this.back,
      close: this.close,
      onTransition: this.onTransition, 
      onRootTransition: this.onRootTransition,
      activeView: currentPanel.view,
      history: {
        [currentPanel.view]: [currentPanel.name],
      },
      activePanels: {
        [currentPanel.view]: currentPanel.name,
      }, 
      activeModals:[],
    };
 
  }

  private readonly onRouteChange = (newRoute: any, previousRoute:any) => {
    const newRouteData= getPanelData(newRoute.name, this.props.routes); 
    const { only_page, ...routeParams } = newRoute.params;
    const params = { ...this.state.params, [newRoute.name]: routeParams };
     
    this.setState({
      previousRoute,
      params,
      activeView: newRouteData.view,
      activePanels: {
        ...this.state.activePanels,
        [newRouteData.view]: newRouteData.name,
      },
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



