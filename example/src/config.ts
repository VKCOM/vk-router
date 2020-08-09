import { isDev, isStaging } from '@vkontakte-internal/vkui-common';

const config = {
  apiVersion: '5.93',
  scope: 'offline,groups,stories',
  app_id: 999999,
  apiHost: 'api.vk.com'
};

const prodConfig = {
  ...config
};

const stagingConfig = {
  ...config
};

const devConfig = {
  ...config,
  apiHost: 'dev-api-host.com'
};

export default isDev ? devConfig : isStaging ? stagingConfig : prodConfig;