
let query = querystring.parse(window.location.href);

if (['desktop_web', 'mobile_web'].includes(query.vk_platform) && location.hash) {
  query = {...query, ...querystring.parse(location.hash.replace('#', ''))};
}

if (query.vk_platform === 'desktop_web') {
  query.is_desktop = 1;
}

const defaultParams = query;

if (history.state && history.state.params && history.state.params.modal) {
  defaultParams.modal = history.state.params.modal;
  defaultParams['modal-props'] = history.state.params['modal-props'];
}

const router = createRouter(routes, {
  defaultRoute: PANEL_BROADCAST_MAIN,
  defaultParams,
});

router.usePlugin(browserPlugin({ base: '.', useHash: true }));
router.usePlugin(listenersPlugin())
router.usePlugin(persistentParamsPlugin(['owner_id']));
router.start();

router.navigate(router.getState().name, defaultParams, { replace: true });

export default router;
