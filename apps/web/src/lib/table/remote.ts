import { CLOSE_REPLACED, CLOSE_ROOM_ENDED, CLOSE_ROOM_NOT_FOUND, DEFAULT_TEAM_NAMES, PING_INTERVAL, type ClientMessage, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { canRaise, coverAllowed, createGame, viewFor, type CardId, type DezAction, type GameEvent, type GameView, type RespondAction, type Rules, type Seat, type Team } from '@truco/rules';
import { realClock, type Clock } from './clock';
import { actingFor, type SeatView, type Table, type TableListener, type TableSnapshot } from './table';

export type RemoteStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';
/** Por que a conexão fechou de vez (códigos 4xxx do servidor). */
export type ClosedReason = 'room-not-found' | 'room-ended' | 'replaced' | null;

export interface RemoteState {
  status: RemoteStatus;
  room: RoomSnapshot | null;
  reason: ClosedReason;
  /** tentativas de reconexão seguidas; zera quando abre */
  attempt: number;
}

/**
 * O que usamos do WebSocket do navegador, para injetar um falso nos testes. Os handlers recebem `any`
 * porque o nativo tipa cada evento de um jeito e só lemos `data` e `code`.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: any) => void) | null;
  onmessage: ((ev: any) => void) | null;
  onclose: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
export type SocketFactory = (url: string) => SocketLike;

export const BACKOFF_START = 500;
export const BACKOFF_MAX = 10_000;
const EMPTY_SEAT = '(vazia)';

const CLOSE_REASONS: Record<number, ClosedReason> = { [CLOSE_ROOM_NOT_FOUND]: 'room-not-found', [CLOSE_ROOM_ENDED]: 'room-ended', [CLOSE_REPLACED]: 'replaced' };

/**
 * A mesa online (ADR 0003): conecta na sala com o token do navegador, aplica os snapshots inteiros
 * que o servidor manda e reconecta sozinha com espera crescente. A sala (lobby, quem está, duplas) sai
 * por `state`/`watch`; a mesa (cadeira, cartas, de quem é a vez) sai por `snapshot`/`subscribe`, como na mesa local.
 * As ações de jogo chegam com a partida online; por enquanto a cadeira só olha.
 */
export class RemoteTable implements Table {
  private st: RemoteState = { status: 'idle', room: null, reason: null, attempt: 0 };
  private snap: TableSnapshot;
  private coverNext = false;
  private socket: SocketLike | null = null;
  private timer: unknown;
  private disposed = false;
  private joinedAs: string | null = null;
  /** eventos que chegaram e esperam o snapshot que os causou */
  private pendingEvents: GameEvent[] = [];
  /** eventos publicados quando ninguém ouvia (a tela da mesa monta depois do snapshot que começa a partida) */
  private unheard: GameEvent[] = [];
  private readonly watchers = new Set<(state: RemoteState) => void>();
  private readonly listeners = new Set<TableListener>();
  private readonly makeSocket: SocketFactory;
  private readonly clock: Clock;

  constructor(private readonly target: { url: string; room: string; token: string }, opts: { socket?: SocketFactory; clock?: Clock } = {}) {
    this.makeSocket = opts.socket ?? ((url) => new WebSocket(url));
    this.clock = opts.clock ?? realClock;
    this.snap = this.takeSnapshot();
  }

  get state() { return this.st; }
  get snapshot() { return this.snap; }

  /** Mudanças da sala (conexão, quem está, lobby). */
  watch(listener: (state: RemoteState) => void) {
    this.watchers.add(listener);
    return () => { this.watchers.delete(listener); };
  }
  /** Mudanças da mesa, com os eventos que as causaram. O primeiro ouvinte recebe na hora o que ninguém ouviu. */
  subscribe(listener: TableListener) {
    this.listeners.add(listener);
    if (this.unheard.length) { const events = this.unheard; this.unheard = []; listener(this.snap, events); }
    return () => { this.listeners.delete(listener); };
  }

  connect() {
    if (this.disposed || this.socket) return;
    this.clearTimer();
    const url = `${this.target.url}?room=${encodeURIComponent(this.target.room.toUpperCase())}&token=${encodeURIComponent(this.target.token)}`;
    const ws = this.makeSocket(url);
    this.socket = ws;
    this.set({ status: this.st.attempt ? 'reconnecting' : 'connecting' });
    ws.onopen = () => { if (this.socket !== ws) return; this.set({ status: 'open', attempt: 0 }); this.schedulePing(); };
    ws.onmessage = (ev: { data: unknown }) => { if (this.socket === ws) this.receive(String(ev.data)); };
    ws.onerror = () => {};
    ws.onclose = (ev: { code: number }) => { if (this.socket === ws) this.lost(ev.code); };
  }

  /** Reconecta agora, se estava esperando (ex.: o navegador voltou a ter rede). */
  retryNow() { if (this.st.status === 'reconnecting' && !this.socket) this.connect(); }

  // sala
  join(nickname: string) { this.joinedAs = nickname; this.send({ type: 'join', nickname }); }
  setNickname(nickname: string) { this.joinedAs = nickname; this.send({ type: 'nickname', nickname }); }
  takeSeat(team: Team) { this.send({ type: 'takeSeat', team }); }
  leaveSeat() { this.send({ type: 'leaveSeat' }); }
  renameTeam(team: Team, name: string) { this.send({ type: 'renameTeam', team, name }); }
  setRules(rules: Rules) { this.send({ type: 'rules', rules }); }
  setGhostsSeeCards(on: boolean) { this.send({ type: 'ghostsSeeCards', on }); }
  start() { this.send({ type: 'start' }); }

  // mesa — as ações de jogo viram mensagens quando a partida online chegar
  newGame() {}
  play(_id: CardId, _covered = this.coverNext) {}
  raise() {}
  respond(_action: RespondAction) {}
  decideDez(_action: DezAction) {}
  toggleCover() {
    const next = !this.coverNext && coverAllowed(this.snap.game);
    if (next === this.coverNext) return;
    this.coverNext = next;
    this.publish([]);
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
    const ws = this.socket; this.socket = null;
    ws?.close(1000, 'saiu');
    this.set({ status: 'closed' });
    this.watchers.clear();
    this.listeners.clear();
  }

  private receive(raw: string) {
    let msg: ServerMessage;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'events') { this.pendingEvents.push(...msg.events); return; }
    if (msg.type !== 'snapshot') return;
    this.set({ room: msg.snapshot });
    if (msg.snapshot.you === null && this.joinedAs) this.send({ type: 'join', nickname: this.joinedAs }); // a sala nos esqueceu enquanto estávamos fora
    const events = this.pendingEvents; this.pendingEvents = [];
    if (events.some((e) => e.type === 'newHand')) this.coverNext = false;
    this.publish(events);
  }

  private publish(events: GameEvent[]) {
    this.snap = this.takeSnapshot();
    if (this.listeners.size === 0) { this.unheard.push(...events); return; }
    for (const l of this.listeners) l(this.snap, events);
  }

  private takeSnapshot(): TableSnapshot {
    const room = this.st.room;
    const game: GameView = room?.game ?? viewFor(createGame(room?.rules), 'all');
    const me = room?.members.find((m) => m.id === room.you);
    const seat = me?.seat ?? null;
    const seats: SeatView[] = [0, 1, 2, 3].map((s) => {
      const m = room?.members.find((o) => o.seat === s);
      return { name: m?.nickname ?? EMPTY_SEAT, bot: m?.bot ?? false };
    });
    return {
      game, seat, seats, teams: room ? [...room.teams] : [...DEFAULT_TEAM_NAMES], acting: actingFor(game, seat), coverNext: this.coverNext,
      canRaise: seat !== null && canRaise(game, seat), canCover: coverAllowed(game), rulesEditable: false, canRestart: false,
    };
  }

  private lost(code: number) {
    this.socket = null;
    this.clearTimer();
    const reason = CLOSE_REASONS[code];
    if (reason) { this.set({ status: 'closed', reason }); return; }
    const wait = Math.min(BACKOFF_MAX, BACKOFF_START * 2 ** this.st.attempt);
    this.set({ status: 'reconnecting', attempt: this.st.attempt + 1 });
    this.timer = this.clock.setTimeout(() => { this.timer = undefined; this.connect(); }, wait);
  }

  private schedulePing() {
    this.clearTimer();
    this.timer = this.clock.setTimeout(() => { this.timer = undefined; this.send({ type: 'ping' }); this.schedulePing(); }, PING_INTERVAL);
  }

  private send(message: ClientMessage) { if (this.st.status === 'open') this.socket?.send(JSON.stringify(message)); }

  private set(patch: Partial<RemoteState>) {
    this.st = { ...this.st, ...patch };
    for (const l of this.watchers) l(this.st);
  }

  private clearTimer() { if (this.timer !== undefined) { this.clock.clearTimeout(this.timer); this.timer = undefined; } }
}
