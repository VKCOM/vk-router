export const buildFakeHistory = (url: string) => {
  const { origin, pathname } = new URL(url);
  const paths:string[] = pathname.split('/').filter(path => path);
  let pathstring = '';
  paths.forEach(path=>{
      pathstring+=`/${path}`;
      const url = `${origin}${pathstring}`;
      history.pushState(null, null, url);
      return url;
  });
};