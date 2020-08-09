import React from 'react';
import { Root, View, Panel, Button, ModalRoot, ModalPage, ModalCard } from '@vkontakte/vkui';
import { withNavigator, WithNavigator } from '../../src/hoc/withNavigator';

interface AppProps extends WithNavigator{

};

interface AppState{
    activeModal?:string,
    activePanel?:string,
    activeView?: string,
};

class App extends React.Component<AppProps>{
    state: AppState;
    
    constructor(props: AppProps){
        super(props);
        const { router } = this.props;

        router.addListener(this.onRouteChange);
       
    }

    onRouteChange = () =>{

    }

    onRootTransition = () =>{

    }

    onTransition = () =>{
        
    }

    render(){
        const { activeModal, activePanel, activeView } = this.state;

        const modal1 = (
            <ModalRoot activeModal={activeModal}>
              <ModalPage id="select">
                ...
              </ModalPage>
              <ModalCard id="faq">
                ...
              </ModalCard>
            </ModalRoot>
        );

        const modal2 = (
            <ModalRoot activeModal={activeModal}>
              <ModalPage id="select">
                ...
              </ModalPage>
              <ModalCard id="faq">
                ...
              </ModalCard>
            </ModalRoot>
        );

        const modal3 = (
            <ModalRoot activeModal={activeModal}>
              <ModalPage id="select">
                ...
              </ModalPage>
              <ModalCard id="faq">
                ...
              </ModalCard>
            </ModalRoot>
        );
        return (
        <Root activeView={activeView}>
          <View id="view1" activePanel={activePanel} modal={modal1}>
            <Panel id="panel1">
                <h1> Панель 1</h1>
                <div>
                    <Button onClick={()=> this.props.go('/panel2')} >
                         Перейти на панель 2
                    </Button>
                </div>
                <div>
                    <Button onClick={()=> this.props.go('/route')} >
                         Открыть модальное окно
                    </Button>
                </div>
                <div>
                    <Button onClick={()=> this.props.go('/panel2/modal')} >
                         Открыть модальное окно на панели 2
                    </Button>
                </div>
            </Panel>
            <Panel id="panel1">
                <h1>Панель 1</h1>
                <div>
                    <Button onClick={()=> this.props.go('/route')} />
                </div>
            </Panel>
          </View>
          <View id="view2" activePanel="panel" modal={modal2}>
            <Panel id="panel2" />
          </View>
          <View id="view2" activePanel="panel" modal={modal3}>
            <Panel id="panel3" />
          </View>  
        </Root>
        )
    }
}


export default withNavigator(App)


