import { NavigatorRoute } from "..";
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
}

export default class TreeRoutes {
  private root: RouteNode;
  private errorLogger = (err: string) => console.error(err);

  constructor(config: TreeRoutesConfig) {
    if (config.errorLogger) {
      this.errorLogger = config.errorLogger;
    }
    const rootData = {
      name: "",
      path: "",
      params: "",
      children: [] as RouteNode[],
    };
    this.root = new RouteNode(rootData);
  }

  public contains = (callback: TreeCallback) => {
    this.traverse(callback);
  };

  public add = (
    routeNode: RouteNode | NavigatorRoute,
    parentNode?: RouteNode
  ) => {
    let child =
        routeNode instanceof RouteNode ? routeNode : new RouteNode(routeNode),
      parent: RouteNode = null;

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
    const segments = pathToRoute.split(".");
    const targetSegment = segments[segments.length - 1];
    const stack = [...this.root.children];
    let resultNode: RouteNode | null = null;

    const lookUpSegment = (segment: string) => {
      while (stack.length) {
        const route = stack.pop();
        if (route.name === segment) {
          console.log(stack, route, segment);
          stack.push(...route.children);
        } else if (route.name === targetSegment) {
          resultNode = route;
        }
      }
    };
    segments.forEach(lookUpSegment);

    if (!resultNode) {
      this.errorLogger(ERROR_TREE_NO_ROUTE);
    }

    return resultNode;
  };

  private findByPath = (pathToRoute: string) => {
    const segments = pathToRoute.split(".");
    let pathCount: number = segments.length;
    const targetSegment = segments[segments.length - 1];

    let resultNode: RouteNode | null = null;

    const checkNodeExists = (segment: string) => {
      this.contains((node: RouteNode) => {
        if (node.name === segment) {
          --pathCount;
        }
        if (pathCount === 0 && node.name === targetSegment) {
          resultNode = node;
        }
      });
    };

    segments.forEach(checkNodeExists);

    if (!resultNode) {
      this.errorLogger(ERROR_TREE_NO_ROUTE);
    }

    return resultNode;
  };

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
        var i = 0,
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

  public getRouteNode = (routeName: string = "") => {
    const pathToRoute = routeName && routeName.includes(".") ? routeName : "";
    const routeNode: RouteNode = pathToRoute
      ? this.findByPath(pathToRoute)
      : this.findByName(routeName);

    if (!(routeNode instanceof RouteNode)) {
      // this.errorLogger(ERROR_ROUTE_NOT_REGISTERED);
    }

    let revertedObjectPath = "";

    (function printRoute(node) {
      if (node instanceof RouteNode && node.name) {
        revertedObjectPath += `.${node.name}`;
        if (node.parent) {
          printRoute(node.parent);
        }
      }
    })(routeNode);

    const routePath = revertedObjectPath
      .split(".")
      .reverse()
      .join(".")
      .replace(/\.$/, "");
    return { routePath, routeNode };
  };
}

export function createRoutesTree(
  routes: RouteNode[],
  config: TreeRoutesConfig = {}
) {
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
  })(routes);

  return RoutesTree;
}
