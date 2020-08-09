import React from 'react';
import ReactDOM from 'react-dom';
import { Init, isDev } from '@vkontakte-internal/vkui-common';
import App from './App';
import config from './config';
import routes from './routes';
import Navigator from '../../src/Navigator';


ReactDOM.render(
  <Init
    access_token={isDev ? localStorage.getItem('{app_name}:access_token') : undefined}
    apiVersion={config.apiVersion}
    apiHost={config.apiHost}
    app_id={config.app_id}
    scope={config.scope}
    appTitle="Тестирование модуль навигации"
  >
    <Navigator routes={routes}>
        <App />
    </Navigator>
  </Init>,
  document.getElementById('root')
);