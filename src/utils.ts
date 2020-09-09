import { URLParamsCollection } from './types';

export const getUrlParams = (url: string) => {
    const hashes = url.slice(url.indexOf('?') + 1).split('&')
    const params: URLParamsCollection = {}
    hashes.map(hash => {
        const [key, val] = hash.split('=')
        params[key] = decodeURIComponent(val)
    })
    return params;
}

export const buildUrlParams = (params: URLParamsCollection) => {
    const esc = encodeURIComponent;
    const query = Object.keys(params)
        .map(k => esc(k) + '=' + esc(params[k]))
        .join('&');
    return query;
};

