import { NavigatorRoute } from "..";
import { getParentPath, isPath, cutName, getByPath } from "./utils";
import {
  ERROR_TREE_PARENT_DOESNT_EXIST,
  ERROR_TREE_NO_ROUTE,
  ERROR_ROUTE_NOT_REGISTERED,
  ERROR_NODE_TO_REMOVE_NOT_EXIST,
  ERROR_PARENT_DOESNT_EXIST,
} from "../constants";

import RouteNode from "./RouteNode";
import { TreeCallback } from "./types";

export interface TreeRoutesConfig {
  errorLogger?: (err: string) => void;
  useAdapter?: boolean;
}

export default class TreeRoutes {
  private root: RouteNode;
  private errorLogger = (err: string, arg?: string) => console.error(err, arg);

  constructor(config: TreeRoutesConfig) {
    if (config.errorLogger) {
      this.errorLogger = config.errorLogger;
    }
    const rootData: RouteNode = {
      name: "",
      routePath: "",
      params: "",
      children: [],
    };

    this.root = new RouteNode(rootData);
  }

  public contains = (callback: TreeCallback) => {
    this.traverse(callback);
  };

  public getParentNode = (path: string) => {
    const pathToParent = getParentPath(path);
    const parent = this.getByPath(pathToParent);
    if (parent) {
      return parent;
    }
  };

  public add = (
    routeNode: RouteNode | NavigatorRoute,
    parentNode?: RouteNode
  ) => {
    let child =
      routeNode instanceof RouteNode ? routeNode : new RouteNode(routeNode);
    let parent: RouteNode = null;

    this.contains((node: RouteNode) => {
      if (parentNode && node && node.name === parentNode.name) {
        parent = node;
      } else if (!parentNode) {
        parent = this.root;
      }
    });

    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(child);
      child.parent = parent;
    } else {
      this.errorLogger(ERROR_TREE_PARENT_DOESNT_EXIST);
    }
  };

  private getByPath = (pathToRoute: string) => {
    const resultNode = getByPath(this.root.children, pathToRoute);
    if (!resultNode) {
      this.errorLogger(ERROR_TREE_NO_ROUTE);
    }
    return resultNode;
  };

  // only first occurence
  private findByName = (nodeName: string) => {
    let resultNode;
    this.contains((node: RouteNode) => {
      if (node.name === nodeName) {
        resultNode = node;
      }
    });

    if (!resultNode) {
      this.errorLogger(ERROR_TREE_NO_ROUTE);
    }

    return resultNode;
  };

  public remove = (routeName: string) => {
    let parent: RouteNode = null,
      childToRemove = null,
      index;

    this.contains((node: RouteNode) => {
      if (node.name === routeName) {
        parent = node;
      }
    });

    if (parent) {
      index = this.findIndex(parent.children, routeName);
      if (index === undefined) {
        this.errorLogger(ERROR_NODE_TO_REMOVE_NOT_EXIST);
      } else {
        childToRemove = parent.children.splice(index, 1);
      }
    } else {
      this.errorLogger(ERROR_PARENT_DOESNT_EXIST);
    }

    return childToRemove;
  };

  private traverse = (callback: TreeCallback) => {
    (function recurse(currentNode) {
      for (
        let i = 0,
          length = currentNode.children ? currentNode.children.length : 0;
        i < length;
        i++
      ) {
        recurse(currentNode.children[i]);
      }
      callback(currentNode);
    })(this.root);
  };

  public findIndex = (routes: RouteNode[], routeName: string) => {
    return routes.findIndex((route: RouteNode) => route.name === routeName);
  };
  
  public getRouteNode = (routeName: string = ""): RouteNode => {
    const pathToRoute = isPath(routeName) ? routeName : "";

    const routeNode: RouteNode = pathToRoute
      ? this.getByPath(pathToRoute)
      : this.findByName(routeName);

    if (!(routeNode instanceof RouteNode)) {
      this.errorLogger(ERROR_ROUTE_NOT_REGISTERED, pathToRoute);
    }

    return routeNode;
  };
}

const getParentNode = (routes: RouteNode[], path: string) => {
  const parentPath = getParentPath(path);
  const parent = getByPath(routes, parentPath);
  return parent;
};

const makePreTreeRoute = (route: NavigatorRoute) => {
  const { path, name, ...routeProps } = route;
  const preTreeRoute: NavigatorRoute = {
    ...routeProps,
    name: cutName(name),
    routePath: name
  };

  return preTreeRoute;
};

const createPreTree = (routes: NavigatorRoute[]) => {
  const preTree: NavigatorRoute[] = [];

  const iterateRoute = (
    route: NavigatorRoute | NavigatorRoute[],
    parent?: NavigatorRoute
  ) => { 
    if (Array.isArray(route)) {
      route.forEach((el) => iterateRoute(el));
    
    } else if (route) {
      const preTreeRoute = makePreTreeRoute(route);
      
      if (parent) {
        parent.children.push(preTreeRoute);
      
      } else if (isPath(route.name)) {
        const parent = getParentNode(preTree, route.name);
        
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(preTreeRoute);
        }
      
      } else {
        preTree.push(preTreeRoute);
      }
      
      if (Array.isArray(route.children)) {
        route.children.forEach((el: RouteNode) => iterateRoute(el, route));
      }
    }
  };
  
  iterateRoute(routes);
  return preTree;
};

export function createRoutesTree(
  routes: RouteNode[],
  config: TreeRoutesConfig = {}
) {
  const proceedRoutes: NavigatorRoute[] = createPreTree(routes);

  const RoutesTree = new TreeRoutes(config);

  (function addRoutes(route: RouteNode[] | RouteNode, parent?: RouteNode) {
    if (Array.isArray(route)) {
      route.forEach((el) => addRoutes(el));
    } else if (route) {
      const routeNode = new RouteNode(route);
      if (parent) {
        RoutesTree.add(routeNode, parent);
      } else {
        RoutesTree.add(routeNode);
      }

      if (Array.isArray(route.children)) {
        route.children.forEach((el: RouteNode) => addRoutes(el, routeNode));
      }
    }
  })(proceedRoutes);

  return RoutesTree;
}
