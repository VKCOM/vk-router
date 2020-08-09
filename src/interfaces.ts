export interface OnTransitionParams {
  from: string;
  to: string;
  isBack: string;
}

export interface RouteDefinition {
  [key:string] : any
}
  
export type Go = (to: string, params?: any, options?: any) => void;