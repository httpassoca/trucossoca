/**
 * Quem esta aba é para o servidor. O token vive na aba (sessionStorage): sobrevive a refresh e queda de rede,
 * e duas abas do mesmo navegador são duas pessoas na sala. O apelido é lembrado pelo navegador inteiro.
 */
const TOKEN_KEY = 'truco.token';
const NICKNAME_KEY = 'truco.nickname';

function read(store: Storage, key: string) { try { return store.getItem(key) ?? ''; } catch { return ''; } }
function write(store: Storage, key: string, value: string) { try { store.setItem(key, value); } catch { /* modo privado ou bloqueado: segue sem lembrar */ } }

export function token(): string {
  let t = read(sessionStorage, TOKEN_KEY);
  if (!t) { t = crypto.randomUUID(); write(sessionStorage, TOKEN_KEY, t); }
  return t;
}

export const rememberedNickname = () => read(localStorage, NICKNAME_KEY);
export const rememberNickname = (nickname: string) => write(localStorage, NICKNAME_KEY, nickname);
