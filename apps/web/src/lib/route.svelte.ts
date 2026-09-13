/** Rotas: `/` início, `/sala/CODE` sala, `/offline` mesa local, `/offline/assistir` quatro bots e a pessoa de fantasma. O código vai na URL para o link funcionar. */
export type Route = { name: 'home' } | { name: 'room'; code: string } | { name: 'offline'; watch: boolean };

export function parseRoute(pathname: string): Route {
  const sala = pathname.match(/^\/sala\/([A-Za-z0-9]+)\/?$/);
  if (sala) return { name: 'room', code: sala[1].toUpperCase() };
  const offline = pathname.match(/^\/offline(\/assistir)?\/?$/);
  if (offline) return { name: 'offline', watch: !!offline[1] };
  return { name: 'home' };
}

export const roomPath = (code: string) => `/sala/${code.toUpperCase()}`;

export const route = $state({ current: parseRoute(typeof location === 'undefined' ? '/' : location.pathname) });

export function navigate(path: string) {
  history.pushState(null, '', path);
  route.current = parseRoute(path);
}

if (typeof window !== 'undefined') window.addEventListener('popstate', () => { route.current = parseRoute(location.pathname); });
