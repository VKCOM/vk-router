export default class RouteNode {
    [key:string]: any;
    path?: string;
    name: string;
    parent?: RouteNode | null;
    children?: RouteNode[];
    encodeParams?: () => {};
    decodeParams?: () => {};

    constructor(data: RouteNode) {
       const { name, path, params, encodeParams, decodeParams, ...rest} = data;
       this.name = name;
       this.path = path; 
       this.params = params || [];
       this.parent = null;
       this.data = rest;
       this.children = [];
       this.encodeParams = encodeParams; 
       this.decodeParams = decodeParams;
    }
};