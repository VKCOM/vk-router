import { NavigatorRoute } from '..';
import { 
    ERROR_TREE_PARENT_DOESNT_EXIST, 
    ERROR_TREE_NO_ROUTE, ERROR_ROUTE_NOT_REGISTERED, 
    ERROR_NODE_TO_REMOVE_NOT_EXIST,
    ERROR_PARENT_DOESNT_EXIST
} from '../constants';

import RouteNode from './RouteNode';
import { TreeCallback } from './types';

export default class TreeRoutes {
  private root: RouteNode; 
  private errorLogger = (err: string) => console.error(err);

  constructor() {
    const rootData = { name: '', path: '', params: '', children: [] as RouteNode[] };
    this.root = new RouteNode(rootData);
  }


  contains = (callback: TreeCallback, traversal: any) => {
    traversal.call(this, callback);
  };
 
  add = (routeNode: RouteNode | NavigatorRoute, parentNode?: RouteNode, traversal = this.traverseDF) => {        
    let child = routeNode instanceof RouteNode ? routeNode : new RouteNode(routeNode),
      parent: RouteNode = null;
      
      this.contains((node: RouteNode) => {
        if (parentNode && node && node.name === parentNode.name) {
          parent = node;
        } else if (!parentNode) {
          parent = this.root;
        }                 
      }, traversal);
            
        if (parent) {            
            parent.children = parent.children || [];
            parent.children.push(child);
            child.parent = parent; 
        } else {
            this.errorLogger(ERROR_TREE_PARENT_DOESNT_EXIST);
        }
    };

    findByPath = (pathToRoute: string) => {
      const segments = pathToRoute.split('.');
      const targetSegment = segments[segments.length - 1];
      let resultNode;

      this.contains((node: RouteNode) => {
        if (node.name === targetSegment) {
            resultNode = node;
        }
        }, this.traverseDF);
       
       if(!resultNode){
          this.errorLogger(ERROR_TREE_NO_ROUTE);
       }

       return resultNode;
    }

    findByName = (nodeName: string) => {
      let resultNode;
      this.contains((node: RouteNode) => {
        if (node.name === nodeName) {
            resultNode = node;
        }
      }, this.traverseDF);
       
       if (!resultNode) {
          this.errorLogger(ERROR_TREE_NO_ROUTE);
       }

       return resultNode;
    }
  
    // TODO: remove method
    remove = (routeName: string, traversal = this.traverseDF) => {
        let parent: RouteNode = null,
            childToRemove = null,
            index;
     
        this.contains((node: RouteNode) => {
            if (node.name === routeName) {
                parent = node;
            }
        }, traversal);
     
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
 
    traverseDF = (callback: any) => {
        (function recurse(currentNode) {
            for (var i = 0, length = currentNode.children ? currentNode.children.length : 0; i < length; i++) { 
                recurse(currentNode.children[i]);
            }
            callback(currentNode);
        })(this.root);
     };

    matchPath = () => {

    }

    findIndex = (routes: RouteNode[], data: any) => {
        return 0;
    }

    getRouteNode = (routeName: string = '') => {
        const pathToRoute = routeName && routeName.includes('.') ? routeName: '';
        const routeNode: RouteNode = pathToRoute ? this.findByPath(pathToRoute) : this.findByName(routeName);
    
        if(!(routeNode instanceof RouteNode)){
            this.errorLogger(ERROR_ROUTE_NOT_REGISTERED);
        } 
        
        let revertedObjectPath = '';
        
        (function printRoute(node){
          if (node instanceof RouteNode && node.name) {
            revertedObjectPath +=`.${node.name}`;                                  
            if (node.parent){
                printRoute(node.parent); 
              }
          }
        })(routeNode);
         
        const routePath = revertedObjectPath.split('.').reverse().join('.').replace(/\.$/, "");
        return { routePath, routeNode };
    }
 };

export function createRoutesTree (routes: RouteNode[]) {
    const RoutesTree = new TreeRoutes();

    (function addRoutes(route: RouteNode[] | RouteNode, parent?: RouteNode) {
        if (Array.isArray(route)) {
            route.forEach((el)=> addRoutes(el));  
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
};  
