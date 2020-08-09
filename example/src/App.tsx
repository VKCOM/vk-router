import React from 'react';
import { Root, View, Panel } from '@vkontakte/vkui';
import { withNavigator, WithNavigator } from '../../src/';

interface AppProps{
};

class App extends React.Component<AppProps,  WithNavigator>{
    state: AppState
    
    constructor(props){
        super(props);

        this.state: AppState ={
            activeModal,
            activePanel,
            activeView
        }
    }


    render(){
        const { activeModal, activePanel, activeView } = this.state;
        return (
        <Root activeView="view">
          <View id="view" activePanel="panel">
            <Panel id="panel1" ></Panel>
          </View>
          <View id="view" activePanel="panel">
            <Panel id="panel2" />
          </View>
          <View id="view" activePanel="panel">
            <Panel id="panel3" />
          </View> 
          <ModalRoot activeModal="modal1">
              <Modal id="modal1">
                
              </Modal>
          </ModalRoot>
        </Root>
        )
    }
}


export default withNavigator(App)


