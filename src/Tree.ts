import RouteNode from './RouteNode';

export default class TreeRoutes {
    _root: RouteNode;


     constructor() {
         const rootData = { name: '', path: '', params: '', children: [] as RouteNode[]};
         const node = new RouteNode(rootData);
         this._root = node;
         this.remove = this.remove.bind(this);  ;
     }
 
    contains = (callback, traversal) => {
        traversal.call(this, callback);
    };
 
    add = (data, toData, traversal = this.traverseDF) => {        
        let _this = this,
            child = new RouteNode(data),
            parent = null,
            callback = function(node) {
                if (toData && node && node.name === toData.name || node.name === toData) {
                    parent = node;
                } else if(!toData){
                    parent = _this._root;
                }                 
            }; 
     
        this.contains(callback, traversal);
            
        if (parent) {            
            parent.children = parent.children || [];
            parent.children.push(child);
            child.parent = parent; 
        } else {
            throw new Error('Cannot add node to a non-existent parent.');
        }
    };

    findByName = (nodeName) => {
        let resultNode;

        const callback = function(node) {
            if (node.name === nodeName) {
                resultNode = node;
            }
        }; 

       this.contains(callback, this.traverseDF);
       
       if(!resultNode){
            throw new Error('No such route in a tree');
       }

       return resultNode;
    }
  
     remove = (data, fromData, traversal = this.traverseDF) => {
        let parent = null,
            childToRemove = null,
            index;
     
        var callback = function(node) {
            if (node.data === fromData) {
                parent = node;
            }
        };
     
        this.contains(callback, traversal);
     
        if (parent) {
            index = findIndex(parent.children, data);
     
            if (index === undefined) {
                throw new Error('Node to remove does not exist.');
            } else {
                childToRemove = parent.children.splice(index, 1);
            }
        } else {
            throw new Error('Parent does not exist.');
        }
     
        return childToRemove;
    };
 
    traverseDF = (callback) => {
   
        (function recurse(currentNode) {
             
            for (var i = 0, length = currentNode.children ? currentNode.children.length : 0; i < length; i++) { 
                recurse(currentNode.children[i]);
            }
     
            callback(currentNode);
             
        })(this._root);
    
     };
 
    //  traverseBF = (callback) => {
    //     const queue = new Queue();
        
    //     queue.enqueue(this._root);
    
    //     currentTree = queue.dequeue();
    
    //     while(currentTree){
    //         for (var i = 0, length = currentTree.children.length; i < length; i++) {
    //             queue.enqueue(currentTree.children[i]);
    //         }
    
    //         callback(currentTree);
    //         currentTree = queue.dequeue();
    //     }
    // };

    matchPath = () => {

    }

    buildPath = (route, params = {hasHash: false}) => {
        if(!route){
            throw new Error('route is not specified');
        }
        
        const routeNode = this.findByName(route);
    
        if(!(routeNode instanceof RouteNode)){
            throw new Error('route is not registered');
        } 
        
        let revertedPath = '';
        let revertedObjectPath = '';
        
        (function printRoute(node){
            if(node instanceof RouteNode && node.name) {
                revertedPath += `${node.data.path ? node.data.path : `/${node.data.name}`}`;
                revertedObjectPath +=`.${node.name}`;                      
                    
                if(node.parent){
                    printRoute(node.parent); 
                }
            }
        })(routeNode);
        
        let path = revertedPath.split('/').reverse().join('/'); 
        let url = `${window.location}${params.hasHash ? `${hashPrefix}#` : ''}/${path}`;  
        let objectPath = revertedObjectPath.split('.').reverse().join('.');
        return { path, objectPath, url };
    }
 };

export function createRoutesTree (routes) {
    
    const RoutesTree = new TreeRoutes();

    (function addRoutes(route,parent){
        if(Array.isArray(route)){
            route.forEach((el)=> addRoutes(el));  
        } else if(route) {
            if(parent){
                RoutesTree.add(route, parent);   
            } else {
                RoutesTree.add(route);   
            }

            if(Array.isArray(route.children)){
                route.children.forEach((el) => addRoutes(el, route));
            }
        }
    })(routes);

    return RoutesTree;
};  
