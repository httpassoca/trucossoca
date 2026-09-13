import { DEFAULT_SCENERY, DEFAULT_TEAM_NAMES, PRESENCE_INTERVAL, type Presence, type SceneryId } from '@truco/protocol';
import { createGame, responderSeat, teamOf, viewFor, type CardId, type DezAction, type GameEvent, type GameReadable, type GameView, type RespondAction, type Seat } from '@truco/rules';

/** Quem ocupa cada cadeira, como a interface mostra: `bot` é um bot de verdade; `botControlled`, uma pessoa por quem um bot joga enquanto ela está ausente. */
export interface SeatView { name: string; bot: boolean; botControlled: boolean }
/** Outra pessoa sem cadeira, que anda pela mesa; `id` é a chave da presença dela. */
export interface GhostView { id: string; name: string; connected: boolean }
/** A cena fala de presença por aqui, nunca pelo protocolo (ADR 0003): o tipo e o ritmo em que a própria sai. */
export type { Presence };
export { PRESENCE_INTERVAL };

/**
 * O que a mesa mostra a este cliente. É um objeto novo a cada mudança, nunca mutado no lugar,
 * então a interface pode reagir por identidade. Online, `game` chega do servidor só com as próprias cartas.
 */
export interface TableSnapshot {
  game: GameView;
  /** cadeira que esta pessoa controla agora; null = fantasma, só olha */
  seat: Seat | null;
  /** quem está em cada cadeira */
  seats: SeatView[];
  /** nomes das duplas: a 0 senta nas cadeiras 0 e 2, a 1 nas 1 e 3 */
  teams: [string, string];
  /** os outros fantasmas da mesa (nunca esta pessoa); offline não há */
  ghosts: GhostView[];
  /** de quem a mesa espera uma ação (pessoa ou bot); -1 = ninguém (mão encerrada, fim de jogo) */
  acting: Seat | -1;
  /** a próxima carta da cadeira local vai coberta */
  coverNext: boolean;
  /** a cadeira local pode trucar agora */
  canRaise: boolean;
  /** cobrir é permitido nesta vaza */
  canCover: boolean;
  /** as regras (e a configuração da mesa) podem ser mexidas daqui; online a sala tranca até o fim da partida */
  rulesEditable: boolean;
  /** o que `newGame` faz aqui: recomeça na hora (offline), pede revanche e volta ao lobby (online, no fim de jogo), ou nada */
  restart: 'newGame' | 'rematch' | null;
  /** o cenário ao redor da mesa; online vem da sala, offline é lembrado no navegador */
  scenery: SceneryId;
}

/** Chamado depois de cada mudança com o snapshot novo e os eventos que a causaram (vazio se só a intenção mudou). */
export type TableListener = (snapshot: TableSnapshot, events: GameEvent[]) => void;

/** Única porta entre a interface (cena, HUD, teclado) e o jogo — ADR 0003. Ações ilegais são ignoradas em silêncio. */
export interface Table {
  readonly snapshot: TableSnapshot;
  newGame(): void;
  /** joga pela cadeira local; `covered` default = `snapshot.coverNext` */
  play(id: CardId, covered?: boolean): void;
  raise(): void;
  respond(action: RespondAction): void;
  decideDez(action: DezAction): void;
  toggleCover(): void;
  subscribe(listener: TableListener): () => void;
  dispose(): void;
  /** onde esta pessoa está e para onde olha; online vai aos outros (a mesa local ignora) */
  setPresence(p: Presence): void;
  /** a presença mais recente de um fantasma (por id) ou de quem senta numa cadeira; undefined se nunca chegou. Lida por quadro, fora do snapshot */
  presenceOf(who: Seat | string): Presence | undefined;
  /** troca o cenário: offline na hora; online pede à sala (só vale no lobby) */
  setScenery(scenery: SceneryId): void;
  /**
   * Fantasma senta no lugar do bot da cadeira `seat` e passa a jogar por ela: entre mãos vai na hora; no meio de uma
   * mão fica como intenção e vai quando a mão acabar. `null` desiste. Quem já senta, ou pede uma cadeira que não é de
   * bot, não muda nada.
   */
  takeBotSeat(seat: Seat | null): void;
}

/**
 * De quem a mesa espera a ação, do ponto de vista de `seat`: quando é a dupla de `seat` que responde ao truco
 * ou decide a mão de dez, é a própria cadeira; senão, a cadeira que o motor aponta (na mão de dez, a primeira da dupla).
 */
export function actingFor(g: GameReadable, seat: Seat | null): Seat | -1 {
  const h = g.hand;
  if (!h || g.over || h.phase === 'over') return -1;
  if (h.phase === 'dezDecision') return seat !== null && teamOf(seat) === h.decider ? seat : h.decider === 0 ? 0 : 1;
  if (h.phase === 'respond') { const r = responderSeat(g); return seat !== null && teamOf(seat) === teamOf(r) ? seat : r; }
  return h.turn;
}

/** Mesa sem partida e sem ninguém: o que a interface mostra antes de uma mesa ser encaixada. */
export function emptySnapshot(): TableSnapshot {
  return {
    game: viewFor(createGame(), 'all'), seat: null, seats: [0, 1, 2, 3].map(() => ({ name: '', bot: false, botControlled: false })), teams: [...DEFAULT_TEAM_NAMES], ghosts: [],
    acting: -1, coverNext: false, canRaise: false, canCover: false, rulesEditable: false, restart: null, scenery: DEFAULT_SCENERY,
  };
}
