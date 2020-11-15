import RouteNode from './RouteNode';

export type RouteEncodeDecode = (params: Record<string, any>) => Record<string, any>;

export type TreeCallback = (node: RouteNode) => void;
