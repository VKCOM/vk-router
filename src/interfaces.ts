export interface OnTransitionParams {
  from: string;
  to: string;
  isBack: string;
} 
  
export type Go = (to: string, params?: any, options?: any) => void;