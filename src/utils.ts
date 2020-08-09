export const buildFakeHistory = (url: string) => {
  const { origin, pathname } = new URL(url);
  const paths:string[] = pathname.split('/').filter(path => path);
  let pathstring = '';
  paths.forEach(path=>{
      pathstring+=`/${path}`;
      const urlRecord = `${origin}${pathstring}`;
      history.pushState(null, null, urlRecord);
      return url;
  });
};