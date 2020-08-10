export const buildFakeHistory : VoidFunction = () => { 
  if(window && window.history.length <= 2){ 
    const { origin, hash, pathname } = window.location;
    const hashMode = !!hash;
    const address = hashMode ? hash.replace('#', '') : pathname; 
    const paths = address.split('/').filter(path => path);
    let pathstring = hashMode ? '#': '';
    paths.forEach((path:string) => {
        pathstring+=`/${path}`; 
        history.pushState(null, null, `${origin}${pathstring}`);     
    });
  }
}