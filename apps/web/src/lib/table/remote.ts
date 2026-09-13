import { CLOSE_REPLACED, CLOSE_ROOM_ENDED, CLOSE_ROOM_NOT_FOUND, PING_INTERVAL, type ClientMessage, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { realClock, type Clock } from './clock';

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

const CLOSE_REASONS: Record<number, ClosedReason> = { [CLOSE_ROOM_NOT_FOUND]: 'room-not-found', [CLOSE_ROOM_ENDED]: 'room-ended', [CLOSE_REPLACED]: 'replaced' };

/**
 * A mesa online (ADR 0003): conecta na sala com o token do navegador, aplica os snapshots inteiros
 * que o servidor manda e reconecta sozinha com espera crescente. A parte de jogo da interface `Table`
 * chega com a partida online; por enquanto a mesa remota é a sala.
 */
export class RemoteTable {
  private st: RemoteState = { status: 'idle', room: null, reason: null, attempt: 0 };
  private socket: SocketLike | null = null;
  private timer: unknown;
  private disposed = false;
  private joinedAs: string | null = null;
  private readonly listeners = new Set<(state: RemoteState) => void>();
  private readonly makeSocket: SocketFactory;
  private readonly clock: Clock;

  constructor(private readonly target: { url: string; room: string; token: string }, opts: { socket?: SocketFactory; clock?: Clock } = {}) {
    this.makeSocket = opts.socket ?? ((url) => new WebSocket(url));
    this.clock = opts.clock ?? realClock;
  }

  get state() { return this.st; }

  subscribe(listener: (state: RemoteState) => void) {
    this.listeners.add(listener);
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

  join(nickname: string) { this.joinedAs = nickname; this.send({ type: 'join', nickname }); }
  setNickname(nickname: string) { this.joinedAs = nickname; this.send({ type: 'nickname', nickname }); }

  dispose() {
    this.disposed = true;
    this.clearTimer();
    const ws = this.socket; this.socket = null;
    ws?.close(1000, 'saiu');
    this.set({ status: 'closed' });
    this.listeners.clear();
  }

  private receive(raw: string) {
    let msg: ServerMessage;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'snapshot') {
      this.set({ room: msg.snapshot });
      if (msg.snapshot.you === null && this.joinedAs) this.send({ type: 'join', nickname: this.joinedAs }); // a sala nos esqueceu enquanto estávamos fora
    }
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
    for (const l of this.listeners) l(this.st);
  }

  private clearTimer() { if (this.timer !== undefined) { this.clock.clearTimeout(this.timer); this.timer = undefined; } }
}
