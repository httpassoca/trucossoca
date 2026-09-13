/**
 * Quem esta aba é para o servidor, e o que o navegador lembra entre visitas. O token vive na aba (sessionStorage):
 * sobrevive a refresh e queda de rede, e duas abas do mesmo navegador são duas pessoas na sala. O apelido, as regras,
 * o cenário offline e os grupos abertos do menu são lembrados pelo navegador inteiro (localStorage).
 */
import { DEFAULT_SCENERY, parseRules, SCENERIES, type SceneryId } from '@truco/protocol';
import { defaultRules, type Rules } from '@truco/rules';

const TOKEN_KEY = 'truco.token';
const NICKNAME_KEY = 'truco.nickname';
const SCENERY_KEY = 'truco.scenery';
const RULES_KEY = 'truco.rules';
const MENU_KEY = 'truco.menu';

/** O storage, ou nada (teste, modo privado): aí nada fica lembrado e segue sem quebrar. */
type MaybeStore = Storage | null;
const local = (): MaybeStore => (typeof localStorage === 'undefined' ? null : localStorage);
const session = (): MaybeStore => (typeof sessionStorage === 'undefined' ? null : sessionStorage);

function read(store: MaybeStore, key: string) { try { return store?.getItem(key) ?? ''; } catch { return ''; } }
function write(store: MaybeStore, key: string, value: string) { try { store?.setItem(key, value); } catch { /* modo privado ou bloqueado: segue sem lembrar */ } }
function readJson(store: MaybeStore, key: string): unknown { try { return JSON.parse(read(store, key) || 'null'); } catch { return null; } }

export function token(): string {
  let t = read(session(), TOKEN_KEY);
  if (!t) { t = crypto.randomUUID(); write(session(), TOKEN_KEY, t); }
  return t;
}

export const rememberedNickname = () => read(local(), NICKNAME_KEY);
export const rememberNickname = (nickname: string) => write(local(), NICKNAME_KEY, nickname);

/** O cenário da mesa offline (e o proposto ao abrir uma sala), lembrado pelo navegador; um valor desconhecido volta ao padrão. */
export function rememberedScenery(): SceneryId {
  const v = read(local(), SCENERY_KEY);
  return (SCENERIES as string[]).includes(v) ? (v as SceneryId) : DEFAULT_SCENERY;
}
export const rememberScenery = (scenery: SceneryId) => write(local(), SCENERY_KEY, scenery);

/**
 * As regras que a pessoa ajustou por último: valem no início, na mesa offline e na sala que ela abrir.
 * Validadas como o servidor valida (`parseRules`); qualquer coisa estranha guardada volta ao Mineiro padrão.
 */
export function rememberedRules(): Rules {
  return parseRules(readJson(local(), RULES_KEY)) ?? { ...defaultRules };
}
export const rememberRules = (rules: Rules) => write(local(), RULES_KEY, JSON.stringify(rules));

/** Os grupos do menu da mesa: cada um lembra se ficou aberto ou fechado. */
export type MenuGroup = 'room' | 'keys' | 'rules' | 'scenery' | 'ui';
export function rememberedMenuGroups(): Partial<Record<MenuGroup, boolean>> {
  const v = readJson(local(), MENU_KEY);
  return v && typeof v === 'object' ? (v as Partial<Record<MenuGroup, boolean>>) : {};
}
export const rememberMenuGroup = (group: MenuGroup, open: boolean) => write(local(), MENU_KEY, JSON.stringify({ ...rememberedMenuGroups(), [group]: open }));
