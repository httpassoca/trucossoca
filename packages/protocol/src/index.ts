/**
 * Mensagens trocadas entre cliente e servidor pelo WebSocket, nos dois sentidos, e o snapshot da sala
 * que cada pessoa recebe. Cliente e servidor importam daqui; nada é duplicado.
 */
import { RANKS, SUITS, type CardId, type DezAction, type GameEvent, type GameView, type RespondAction, type Rules, type Seat, type Team } from '@truco/rules';

/** Apelido: tamanho máximo depois de aparado. */
export const NICKNAME_MAX = 20;
/** Nome de dupla: tamanho máximo depois de aparado. */
export const TEAM_NAME_MAX = 20;
/** Nomes das duplas até alguém renomear; a dupla 0 senta nas cadeiras 0 e 2, a 1 nas cadeiras 1 e 3. */
export const DEFAULT_TEAM_NAMES: readonly [string, string] = ['Nós', 'Eles'];
/** O cliente manda `ping` neste intervalo; o servidor derruba quem fica o dobro em silêncio. */
export const PING_INTERVAL = 15_000;
export const SOCKET_IDLE_TIMEOUT = 30_000;

/** Códigos de fechamento do WebSocket que o cliente sabe explicar (4xxx = da aplicação, sem reconectar). */
export const CLOSE_ROOM_NOT_FOUND = 4404;
export const CLOSE_ROOM_ENDED = 4410;
export const CLOSE_REPLACED = 4409;

// cliente → servidor
export type ClientMessage =
  | { type: 'join'; nickname: string }
  | { type: 'nickname'; nickname: string }
  | { type: 'takeSeat'; team: Team }
  | { type: 'leaveSeat' }
  | { type: 'renameTeam'; team: Team; name: string }
  | { type: 'rules'; rules: Rules }
  | { type: 'ghostsSeeCards'; on: boolean }
  | { type: 'start' }
  // jogadas: só de quem está sentado, durante a partida; o servidor aplica com os guardas do motor
  | { type: 'play'; id: CardId; covered: boolean }
  | { type: 'raise' }
  | { type: 'respond'; action: RespondAction }
  | { type: 'decideDez'; action: DezAction }
  /** no fim de jogo, quem está sentado devolve a sala ao lobby com as mesmas cadeiras */
  | { type: 'rematch' }
  | { type: 'ping' };

/** Por que uma jogada foi recusada: fora da partida, sem cadeira, ou o motor não aceitou (fora da vez, fase errada…). */
export type ActionError = 'notPlaying' | 'notSeated' | 'illegal';

// servidor → cliente
export type ServerMessage =
  | { type: 'snapshot'; snapshot: RoomSnapshot }
  /** o que aconteceu na mesa desde o snapshot anterior; o snapshot que os causou vem logo em seguida */
  | { type: 'events'; events: GameEvent[] }
  /** jogada recusada; o cliente ignora com segurança (o snapshot que ele tem continua valendo) */
  | { type: 'error'; action: ClientMessage['type']; reason: ActionError }
  | { type: 'pong' };

export type RoomPhase = 'lobby' | 'playing';

export interface RoomMemberView {
  /** id público e estável dentro da sala; nunca o token */
  id: string;
  nickname: string;
  connected: boolean;
  /** cadeira ocupada; null = fantasma */
  seat: Seat | null;
  bot: boolean;
}

/** Estado inteiro da sala como esta pessoa o vê. Chega inteiro a cada mudança; o cliente nunca faz diff. */
export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  members: RoomMemberView[];
  /** id desta pessoa entre os membros; null enquanto ainda não entrou com apelido */
  you: string | null;
  /** nomes das duplas; a dupla 0 senta nas cadeiras 0 e 2, a 1 nas cadeiras 1 e 3 */
  teams: [string, string];
  /** regras da sala: as da próxima partida no lobby, as em vigor durante a partida */
  rules: Rules;
  ghostsSeeCards: boolean;
  /** a partida como esta pessoa a vê (só as próprias cartas); null no lobby */
  game: GameView | null;
}

/** Lê uma mensagem crua do cliente. Devolve null para qualquer coisa fora do protocolo. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return null; }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  switch (m.type) {
    case 'ping': return { type: 'ping' };
    case 'leaveSeat': return { type: 'leaveSeat' };
    case 'start': return { type: 'start' };
    case 'raise': return { type: 'raise' };
    case 'rematch': return { type: 'rematch' };
    case 'play':
      return isCardId(m.id) && typeof m.covered === 'boolean' ? { type: 'play', id: m.id, covered: m.covered } : null;
    case 'respond':
      return m.action === 'accept' || m.action === 'decline' || m.action === 'raise' ? { type: 'respond', action: m.action } : null;
    case 'decideDez':
      return m.action === 'play' || m.action === 'run' ? { type: 'decideDez', action: m.action } : null;
    case 'join':
    case 'nickname':
      if (typeof m.nickname !== 'string' || m.nickname.length > NICKNAME_MAX * 4) return null;
      return { type: m.type, nickname: m.nickname };
    case 'takeSeat':
      return isTeam(m.team) ? { type: 'takeSeat', team: m.team } : null;
    case 'renameTeam':
      if (!isTeam(m.team) || typeof m.name !== 'string' || m.name.length > TEAM_NAME_MAX * 4) return null;
      return { type: 'renameTeam', team: m.team, name: m.name };
    case 'ghostsSeeCards':
      return typeof m.on === 'boolean' ? { type: 'ghostsSeeCards', on: m.on } : null;
    case 'rules': {
      const rules = parseRules(m.rules);
      return rules ? { type: 'rules', rules } : null;
    }
    default: return null;
  }
}

const isTeam = (v: unknown): v is Team => v === 0 || v === 1;
const isCardId = (v: unknown): v is CardId => typeof v === 'string' && v.length === 2 && (RANKS as string[]).includes(v[0]) && v[1] in SUITS;
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Regras vindas do cliente: só os campos conhecidos, cada um no seu tipo; escada crescente e curta. */
export function parseRules(raw: unknown): Rules | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const bools = ['fixedManilhas', 'useVira', 'raiseOnlyOnTurn', 'alternateRaises', 'allowCovered', 'maoDeDezPeek', 'maoDeFerroBlind', 'allTieNobody'] as const;
  for (const k of bools) if (typeof r[k] !== 'boolean') return null;
  if (!isInt(r.target, 1, 99) || !isInt(r.coverFromTrick, 1, 3) || !isInt(r.maoDeDezValue, 1, 99)) return null;
  if (r.tieLeader !== 'mao' && r.tieLeader !== 'leader') return null;
  const ladder = r.ladder;
  if (!Array.isArray(ladder) || ladder.length === 0 || ladder.length > 10) return null;
  for (let i = 0; i < ladder.length; i++) if (!isInt(ladder[i], 1, 99) || (i > 0 && ladder[i] <= ladder[i - 1])) return null;
  return {
    target: r.target, ladder: [...ladder], coverFromTrick: r.coverFromTrick, maoDeDezValue: r.maoDeDezValue, tieLeader: r.tieLeader,
    fixedManilhas: r.fixedManilhas as boolean, useVira: r.useVira as boolean, raiseOnlyOnTurn: r.raiseOnlyOnTurn as boolean,
    alternateRaises: r.alternateRaises as boolean, allowCovered: r.allowCovered as boolean, maoDeDezPeek: r.maoDeDezPeek as boolean,
    maoDeFerroBlind: r.maoDeFerroBlind as boolean, allTieNobody: r.allTieNobody as boolean,
  };
}
