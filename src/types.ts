export interface URLParamsCollection {
    [key: string]: any
}

export interface NavigatorParams {
    [key:string]: any,
} 

export interface NavigatorRoute {
    [key: string]: any,
    name: string;
    path?: string;
    params?: NavigatorParams;
    subRoute?: boolean;
    updateUrl?: boolean;
    title?: string;
    children?: NavigatorRoute[],
}