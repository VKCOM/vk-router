export default class RouteNode {
    [key:string]: any;
    path?: string;
    name: string;
    children?: RouteNode[];
    encodeParams?: () => {};
    decodeParams?: () => {};

    constructor(data:RouteNode) {
         const { name, path, params, encodeParams, decodeParams, ...rest} = data;
         this.name = name;
         this.path = path; 
         this.parent = null;
         this.data = rest;
         this.children = data.children;
     }
};