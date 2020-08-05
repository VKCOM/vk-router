import React from 'react';
import { Route, Router } from 'router5'; 
import { getPanelData, panelsOrder } from '../routes';
import { createRouter } from 'router5'; 
import browserPlugin from 'router5-plugin-browser';
import listenersPlugin from 'router5-plugin-listeners'
import { querystring } from '@vkontakte-internal/vkui-common';
import persistentParamsPlugin from 'router5-plugin-persistent-params';
import { NavigatorContextProps, NavigatorContext } from './Context';


export class Navigator extends React.PureComponent {
  public state: NavigatorContextProps = {
    router: null,
  };

  public constructor(props) {
    super(props);
    
    const currentRoute = this.state.router.getState();
    const currentPanel = getPanelData(currentRoute.name);

    // @ts-ignore
    this.state.router.addListener(this.onRouteChange);

    this.state = {
      ...this.state,
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
  }

  private readonly onRouteChange = (newRoute: any, previousRoute:any) => {
    const newRouteData = getPanelData(newRoute.name);

    this.setState({
      previousRoute: previousRoute,
      activeView: newRouteData.view,
      activePanels: {
        ...this.state.activePanels,
        [newRouteData.view]: newRouteData.name,
      },
    });
  };

  private readonly onTransition = ({ from, to, isBack }) => {
    const history = [...this.state.history[this.state.activeView] || []];
    const route = this.state.router.getState();
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
        ...this.state.history,
        [this.state.activeView]: history,
      },
    });
  };

  private readonly onRootTransition = ({ from, to, isBack }) => {
    const { history } = this.state;

    if (isBack) {
      this.setState({
        history: {
          ...history,
          [to]: history[to] ? history[to] : [panelsOrder[to][0]],
          [from]: [panelsOrder[from][0]],
        },
      });
    } else {
      this.setState({
        history: {
          ...history,
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



