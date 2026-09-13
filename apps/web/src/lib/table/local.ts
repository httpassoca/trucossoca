import {
  canRaise, chooseBotDez, chooseBotPlay, chooseBotResponse, coverAllowed, createGame, decideDez, playCard, raise,
  respond, startHand, takeEvents, viewFor,
  type CardId, type DezAction, type GameEvent, type GameState, type RespondAction, type Rng, type Rules, type Seat,
} from '@truco/rules';
import { DEFAULT_TEAM_NAMES } from '@truco/protocol';
import { realClock, type Clock } from './clock';
import { actingFor, type Table, type TableListener, type TableSnapshot } from './table';

/** Lidas ao vivo: regras aplicam na próxima mão, bots e ritmo na próxima ação. */
export interface LocalSettings { rules: Rules; bots: boolean; botDelay: number }

/** Quem senta na mesa offline: a pessoa na cadeira 0 e três bots. */
export const LOCAL_NAMES = ['Você', 'Tião', 'Dita', 'Zé'] as const;

/** Pausa entre o fim de uma mão e a seguinte, ms. */
export const HAND_PAUSE = 2200;
/** Bots "pensam" um pouco mais antes de responder truco ou decidir a mão de dez. */
const DECISION_EXTRA = 300;

/**
 * A mesa offline: motor e bots no navegador. Com bots, a pessoa é a cadeira 0;
 * sem bots (modo debug), a cadeira local segue quem tem de agir.
 */
export class LocalTable implements Table {
  private game: GameState;
  private seat: Seat = 0;
  private coverNext = false;
  private snap: TableSnapshot;
  private timer: unknown;
  private readonly listeners = new Set<TableListener>();
  private readonly rng: Rng;
  private readonly clock: Clock;

  constructor(private readonly settings: LocalSettings, opts: { rng?: Rng; clock?: Clock } = {}) {
    this.rng = opts.rng ?? Math.random;
    this.clock = opts.clock ?? realClock;
    this.game = createGame(settings.rules);
    this.snap = this.takeSnapshot();
  }

  get snapshot() { return this.snap; }

  newGame() {
    this.clearTimer();
    this.game = createGame(this.settings.rules);
    this.newHand();
  }

  play(id: CardId, covered = this.coverNext) {
    if (!playCard(this.game, this.seat, id, covered, this.rng)) return;
    this.coverNext = false;
    this.afterAction();
  }
  raise() { if (raise(this.game, this.seat)) this.afterAction(); }
  respond(action: RespondAction) { if (respond(this.game, this.seat, action)) this.afterAction(); }
  decideDez(action: DezAction) {
    if (this.acting() !== this.seat) return;
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

  private newHand() {
    this.clearTimer();
    startHand(this.game, this.rng, { rules: this.settings.rules });
    this.coverNext = false;
    this.afterAction();
  }

  private afterAction() {
    const events = takeEvents(this.game);
    this.schedule();
    this.publish(events);
  }

  private publish(events: GameEvent[]) {
    this.snap = this.takeSnapshot();
    for (const l of this.listeners) l(this.snap, events);
  }

  private takeSnapshot(): TableSnapshot {
    return {
      game: viewFor(this.game, 'all'), seat: this.seat, acting: this.acting(), coverNext: this.coverNext,
      seats: LOCAL_NAMES.map((name, s) => ({ name, bot: this.settings.bots && s !== 0, botControlled: false })), teams: [...DEFAULT_TEAM_NAMES], ghosts: [],
      canRaise: canRaise(this.game, this.seat), canCover: coverAllowed(this.game), rulesEditable: true, restart: 'newGame',
    };
  }

  private humanControls(s: Seat) { return !this.settings.bots || s === 0; }

  /** Com bots, a pessoa responde pela própria dupla mesmo quando o parceiro seria o pé; sem bots, a cadeira local segue quem age. */
  private acting(): Seat | -1 { return actingFor(this.game, this.settings.bots ? 0 : null); }

  /** Pessoa espera o teclado; bot age depois de um delay; mão encerrada espera a pausa. */
  private schedule() {
    this.clearTimer();
    const h = this.game.hand; if (!h) return;
    if (h.phase === 'over') {
      if (!this.game.over) this.timer = this.clock.setTimeout(() => this.newHand(), HAND_PAUSE);
      return;
    }
    const a = this.acting() as Seat;
    this.seat = this.settings.bots ? 0 : a; // sem bots a pessoa segue quem age; com bots ela é sempre a 0
    if (this.humanControls(a)) return;
    const delay = h.phase === 'play' ? this.settings.botDelay : this.settings.botDelay + DECISION_EXTRA;
    this.timer = this.clock.setTimeout(() => this.botAct(a), delay);
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
