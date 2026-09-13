import {
  canRaise, chooseBotDez, chooseBotPlay, chooseBotResponse, coverAllowed, createGame, decideDez, handUntouched, playCard, raise,
  respond, startHand, takeEvents, thinkTime, viewFor,
  type CardId, type DezAction, type GameEvent, type GameState, type RespondAction, type Rng, type Rules, type Seat,
} from '@truco/rules';
import { DEAL_MS, DEFAULT_SCENERY, DEFAULT_TEAM_NAMES, type SceneryId } from '@truco/protocol';
import { realClock, type Clock } from './clock';
import { actingFor, type SeatView, type Table, type TableListener, type TableSnapshot } from './table';

/**
 * Lidas ao vivo: regras aplicam na próxima mão, bots e ritmo na próxima ação; `you` (o nome da cadeira da pessoa) e `teams`
 * (os nomes das duplas), na língua da pessoa, no próximo snapshot. Sem eles, os nomes em português. `botPace` multiplica o
 * que um bot pensa (`thinkTime`: 0.5 rápido, 1 normal, 2 devagar); a coreografia de dar as cartas (`DEAL_MS`) não muda.
 * `watch`: a pessoa é um fantasma numa mesa de quatro bots e vê todas as cartas; senta no lugar de um bot entre mãos
 * (`takeBotSeat`); vale na próxima partida.
 */
export interface LocalSettings { rules: Rules; bots: boolean; botPace: number; you?: string; teams?: [string, string]; scenery?: SceneryId; watch?: boolean }

/** Quem senta na mesa offline sem bots (modo debug): a pessoa na cadeira 0 e três nomes. */
export const LOCAL_NAMES = ['Você', 'Tião', 'Dita', 'Zé'] as const;
/** O bot de cada cadeira: a cadeira 0 só é de um bot quando a pessoa assiste. */
export const LOCAL_BOT_NAMES = ['Nena', 'Tião', 'Dita', 'Zé'] as const;

/** Pausa entre o fim de uma mão e a seguinte, ms. */
export const HAND_PAUSE = 2200;

/**
 * A mesa offline: motor e bots no navegador. Com bots, a pessoa é a cadeira 0, ou um fantasma que assiste quatro bots
 * (`watch`) até sentar no lugar de um deles; sem bots (modo debug), a cadeira local segue quem tem de agir.
 */
export class LocalTable implements Table {
  private game: GameState;
  /** a cadeira que a pessoa controla; null = fantasma */
  private seat: Seat | null;
  /** a cadeira de bot em que o fantasma quer sentar quando a mão acabar */
  private wanted: Seat | null = null;
  private coverNext = false;
  private scenery: SceneryId;
  private snap: TableSnapshot;
  private timer: unknown;
  private readonly listeners = new Set<TableListener>();
  private readonly rng: Rng;
  private readonly clock: Clock;

  constructor(private readonly settings: LocalSettings, opts: { rng?: Rng; clock?: Clock } = {}) {
    this.rng = opts.rng ?? Math.random;
    this.clock = opts.clock ?? realClock;
    this.scenery = settings.scenery ?? DEFAULT_SCENERY;
    this.game = createGame(settings.rules);
    this.seat = this.startingSeat();
    this.snap = this.takeSnapshot();
  }

  get snapshot() { return this.snap; }
  /** a cadeira de bot em que o fantasma vai sentar quando a mão acabar; null = nenhuma */
  get wantsSeat() { return this.wanted; }

  /** Uma partida do zero; quem assiste volta a ser fantasma, quem joga volta à cadeira 0. */
  newGame() {
    this.clearTimer();
    this.game = createGame(this.settings.rules);
    this.seat = this.startingSeat();
    this.wanted = null;
    this.newHand();
  }

  play(id: CardId, covered = this.coverNext) {
    if (this.seat === null || !playCard(this.game, this.seat, id, covered, this.rng)) return;
    this.coverNext = false;
    this.afterAction();
  }
  raise() { if (this.seat !== null && raise(this.game, this.seat)) this.afterAction(); }
  respond(action: RespondAction) { if (this.seat !== null && respond(this.game, this.seat, action)) this.afterAction(); }
  decideDez(action: DezAction) {
    if (this.seat === null || this.acting() !== this.seat) return;
    if (decideDez(this.game, action)) this.afterAction();
  }
  toggleCover() {
    const next = !this.coverNext && coverAllowed(this.game);
    if (next === this.coverNext) return;
    this.coverNext = next;
    this.publish([]);
  }

  subscribe(listener: TableListener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  dispose() { this.clearTimer(); this.listeners.clear(); }
  /** offline ninguém mais está na mesa: presença não vai nem vem */
  setPresence() {}
  presenceOf() { return undefined; }
  setScenery(scenery: SceneryId) {
    if (scenery === this.scenery) return;
    this.scenery = scenery;
    this.publish([]);
  }

  /**
   * O fantasma senta no lugar do bot da cadeira `seat`: sem mão ou na pausa entre mãos, na hora (a pausa em curso não
   * recomeça); no meio de uma mão, fica como intenção e senta quando ela acabar. `null` desiste. Quem já senta, uma
   * cadeira que não é de bot, ou o fim de jogo: nada muda.
   */
  takeBotSeat(seat: Seat | null) {
    if (seat === null || this.seat !== null || !this.isBot(seat) || this.game.over) {
      if (this.wanted !== null) { this.wanted = null; this.publish([]); }
      return;
    }
    const h = this.game.hand;
    if (!h || h.phase === 'over') { this.sit(seat); return; }
    if (this.wanted !== seat) { this.wanted = seat; this.publish([]); }
  }

  private sit(seat: Seat) {
    this.seat = seat;
    this.wanted = null;
    this.coverNext = false;
    this.publish([]);
  }

  private newHand() {
    this.clearTimer();
    startHand(this.game, this.rng, { rules: this.settings.rules });
    this.coverNext = false;
    this.afterAction();
  }

  private afterAction() {
    const events = takeEvents(this.game);
    // a intenção de sentar vai quando a mão acaba (ou cai se já não vale)
    if (this.wanted !== null && this.game.hand?.phase === 'over') {
      if (this.seat === null && this.isBot(this.wanted) && !this.game.over) { this.seat = this.wanted; this.coverNext = false; }
      this.wanted = null;
    }
    this.schedule();
    this.publish(events);
  }

  private publish(events: GameEvent[]) {
    this.snap = this.takeSnapshot();
    for (const l of this.listeners) l(this.snap, events);
  }

  private takeSnapshot(): TableSnapshot {
    const seat = this.seat;
    const seats: SeatView[] = [0, 1, 2, 3].map((s) => ({ name: this.nameOf(s as Seat), bot: this.isBot(s as Seat), botControlled: false }));
    return {
      game: viewFor(this.game, this.settings.bots && seat !== null ? seat : 'all'), seat, acting: this.acting(), coverNext: this.coverNext,
      seats, teams: this.settings.teams ?? [...DEFAULT_TEAM_NAMES], ghosts: [],
      canRaise: seat !== null && canRaise(this.game, seat), canCover: coverAllowed(this.game), rulesEditable: true, restart: 'newGame', scenery: this.scenery,
    };
  }

  /** Com bots, a pessoa começa fantasma (assistindo) ou na cadeira 0; sem bots, a cadeira segue quem age (ver `schedule`). */
  private startingSeat(): Seat | null { return this.settings.bots && this.settings.watch ? null : 0; }
  private isBot(s: Seat) { return this.settings.bots && s !== this.seat; }
  private nameOf(s: Seat) {
    if (s === this.seat) return this.settings.you ?? LOCAL_NAMES[0];
    return this.settings.bots ? LOCAL_BOT_NAMES[s] : LOCAL_NAMES[s];
  }
  private humanControls(s: Seat) { return !this.settings.bots || s === this.seat; }

  /** Com bots, a pessoa responde pela própria dupla mesmo quando o parceiro seria o pé; fantasma e mesa sem bots seguem quem age. */
  private acting(): Seat | -1 { return actingFor(this.game, this.settings.bots ? this.seat : null); }

  /**
   * Pessoa espera o teclado; bot pensa (`thinkTime` vezes o ritmo) e, na primeira ação de cada mão, espera antes a
   * coreografia de dar as cartas (`DEAL_MS`); mão encerrada espera a pausa.
   */
  private schedule() {
    this.clearTimer();
    const h = this.game.hand; if (!h) return;
    if (h.phase === 'over') {
      if (!this.game.over) this.timer = this.clock.setTimeout(() => this.newHand(), HAND_PAUSE);
      return;
    }
    const a = this.acting() as Seat;
    if (!this.settings.bots) this.seat = a; // sem bots a pessoa segue quem age
    if (this.humanControls(a)) return;
    const think = Math.round(thinkTime(this.rng, h.phase === 'play' ? 'play' : 'decision') * this.settings.botPace);
    this.timer = this.clock.setTimeout(() => this.botAct(a), (handUntouched(this.game) ? DEAL_MS : 0) + think);
  }

  private botAct(seat: Seat) {
    const g = this.game, h = g.hand; if (!h) return;
    if (h.phase === 'dezDecision') decideDez(g, chooseBotDez(g, this.rng));
    else if (h.phase === 'respond') respond(g, seat, chooseBotResponse(g, seat, this.rng));
    else if (h.phase === 'play' && h.turn === seat) {
      const c = chooseBotPlay(g, seat, this.rng);
      if (c.kind === 'raise') raise(g, seat); else playCard(g, seat, c.id, c.covered, this.rng);
    } else return;
    this.afterAction();
  }

  private clearTimer() { if (this.timer !== undefined) { this.clock.clearTimeout(this.timer); this.timer = undefined; } }
}
