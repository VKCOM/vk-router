import { buildUrlParams } from '../utils';
export default function myPlugin(router: any, dependencies:any) {
    return {
        onTransitionSuccess: (toState: any, fromState: any) => {
            console.log(
                'Yippee, navigation to ' + toState.name + ' was successful!'
            )
        }
    }
}