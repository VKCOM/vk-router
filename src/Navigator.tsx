import React from 'react';   
import { createRouterInstance, CreateRouterInstanceOptions } from './Router';
import { NavigatorContextProps, NavigatorContext } from './Context';
import { getPanelData } from './utils'; 
 
export interface NavigatorProps {
  routes: any[]
  panelsOrder: any,
} 

export interface TransitionParams {
  from?: string, 
  to?: string, 
  isBack?: string
}

export default class Navigator extends React.PureComponent<NavigatorProps> {
  public state: NavigatorContextProps = {
    router: null,
  };

  public constructor(props: NavigatorProps ) {
    super(props);
    const { routes } = this.props;
    const options:CreateRouterInstanceOptions = {
      routes
    }
    const router = createRouterInstance(options);
    const currentRoute = router.getState();
    const currentPanel = getPanelData(currentRoute.name, routes);
  
    this.state = {
      router,
      onTransition: this.onTransition,
      onRootTransition: this.onRootTransition,
      activeView: currentPanel.view,
      history: {
        [currentPanel.view]: [currentPanel.name],
      },
      activePanels: {
        [currentPanel.view]: currentPanel.name,
      },
    };

    this.state.router.addListener(this.onRouteChange);
  }

  private readonly onRouteChange = (newRoute: any, previousRoute:any) => {
    const newRouteData = getPanelData(newRoute.name, this.props.routes);

    this.setState({
      previousRoute: previousRoute,
      activeView: newRouteData.view,
      activePanels: {
        ...this.state.activePanels,
        [newRouteData.view]: newRouteData.name,
      },
    });
  };

  private readonly onTransition = ({ from, to, isBack }:TransitionParams) => {
    const { activeView, history: prevHistory = {}, router} = this.state;
    if(!activeView || !from || !to || !router){
      return;
    }

    const history = [...prevHistory[activeView] || []];
    const route = router.getState();
    const options = route.meta.source === 'popstate' ? {} : route.meta.options;

    if (!options.replace) {
      if (isBack) {
        history.pop();
      } else {
        history.push(to);
      }
    }

    this.setState({
      params: isBack ? { ...route.params, [from]: {} } : route.params,
      [from]: isBack ? { loaded: false } : this.state[from],
      history: {
        ...prevHistory,
        [activeView]: history,
      },
    });
  };


  private readonly onRootTransition = ({ from, to, isBack }:TransitionParams) => {
    const { history: prevHistory = {}} = this.state;
    const { panelsOrder } = this.props;
    if(!from || !to){
      return;
    }

    if (isBack) {
      this.setState({
        history: {
          ...prevHistory,
          [to]: prevHistory[to] ? prevHistory[to] : [panelsOrder[to][0]],
          [from]: [panelsOrder[from][0]],
        },
      });
    } else {
      this.setState({
        history: {
          ...prevHistory,
          [to]: [panelsOrder[to][0]],
        },
      });
    }
  };
  
  public render() {
    return <NavigatorContext.Provider value={ this.state }>
      { this.props.children }
    </NavigatorContext.Provider>;
  }
}



