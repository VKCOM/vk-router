/**
 * Класс узла дерева навигации
 */
import { RouteEncodeDecode } from './types';
export default class RouteNode {
    [key:string]: any;
    name: string;
    parent?: RouteNode | null;
    children?: RouteNode[];
    encodeParams?: RouteEncodeDecode;
    decodeParams?: RouteEncodeDecode;

    constructor(data: RouteNode) {
       const { name, params, encodeParams, decodeParams, ...rest} = data;
       this.name = name;
       this.params = params || [];
       this.parent = null;
       this.data = rest;
       this.children = [];
       this.encodeParams = encodeParams; 
       this.decodeParams = decodeParams;
    }
};