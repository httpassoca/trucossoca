import { CLOSE_REPLACED, CLOSE_ROOM_ENDED, parseClientMessage, PRESENCE_INTERVAL, SOCKET_IDLE_TIMEOUT, type Presence } from '@truco/protocol';
import type { ServerWebSocket } from 'bun';
import type { Log } from './log';
import { createRoom, step, timerKey, type RoomInit, type RoomInput, type RoomPace, type RoomState } from './room';

/**
 * `now`: hora de nascimento; `pace`: ritmo da mesa (completa os padrões); `init`: regras e cenário de nascimento;
 * `silence`: quanto um socket pode ficar sem mandar nada antes de ser derrubado; `presenceInterval`: o mínimo entre
 * duas presenças repassadas da mesma pessoa.
 */
export interface HostOptions { now?: number; pace?: Partial<RoomPace>; init?: RoomInit; silence?: number; presenceInterval?: number }

export interface SocketData { code: string; token: string }
export type Socket = ServerWebSocket<SocketData>;

/**
 * Adaptador de uma sala: guarda os sockets por token, entrega as mensagens que a sala manda e agenda
 * os timers que ela pede (`state.timers`), nunca os seus. Quando a sala morre, fecha todo mundo e avisa.
 * O único timer próprio é o de silêncio: um socket que não manda nada (nem `ping`) por `silence` ms é
 * derrubado como se tivesse caído, e a sala fica sabendo desde quando a pessoa está muda (a tolerância
 * dela conta dali). A rede que morre sem fechar o socket não chega de outro jeito; o `idleTimeout` do Bun
 * é a rede de segurança abaixo deste.
 * Presença (onde cada pessoa está e para onde olha) não entra na sala: o host repassa a de cada membro aos
 * outros sockets no máximo uma vez por `presenceInterval`, guardando só a mais recente enquanto a janela não abre.
 */
export class RoomHost {
  state: RoomState;
  private readonly sockets = new Map<string, Socket>();
  private readonly handles = new Map<string, ReturnType<typeof setTimeout>>();
  /** por socket: o timer de silêncio e quando ele mandou algo pela última vez */
  private readonly silences = new Map<Socket, { handle: ReturnType<typeof setTimeout>; heardAt: number }>();
  private readonly silence: number;
  private readonly presenceInterval: number;
  /** por token: a última presença recebida, quando a última foi repassada e o timer da próxima, se a janela ainda não abriu */
  private readonly presences = new Map<string, { latest: Presence; sentAt: number; handle?: ReturnType<typeof setTimeout> }>();

  constructor(code: string, private readonly log: Log, private readonly onDead: (code: string) => void, opts: HostOptions = {}) {
    const now = opts.now ?? Date.now();
    this.silence = opts.silence ?? SOCKET_IDLE_TIMEOUT;
    this.presenceInterval = opts.presenceInterval ?? PRESENCE_INTERVAL;
    this.state = createRoom(code, now, opts.pace, opts.init);
    this.syncTimers(now);
    log('room.created', { room: code });
  }

  get code() { return this.state.code; }
  get connections() { return this.sockets.size; }

  connect(ws: Socket) {
    const prev = this.sockets.get(ws.data.token);
    this.sockets.set(ws.data.token, ws);
    // mesma pessoa, socket novo (aba duplicada, ou voltou antes de o servidor notar a queda): o velho sai sem avisar a sala
    if (prev && prev !== ws) { this.clearSilence(prev); prev.close(CLOSE_REPLACED, 'outra aba assumiu'); }
    this.resetSilence(ws);
    this.apply({ kind: 'connect', token: ws.data.token }); // para quem já está conectado, a sala só reenvia o snapshot
  }

  /** O socket fechou (o Bun avisou). */
  disconnect(ws: Socket) { this.drop(ws); }

  message(ws: Socket, raw: string | Buffer) {
    this.resetSilence(ws);
    const message = parseClientMessage(typeof raw === 'string' ? raw : raw.toString());
    if (!message) { this.log('room.badMessage', { room: this.code, token: ws.data.token.slice(0, 8) }); return; }
    if (message.type === 'presence') { this.relayPresence(ws.data.token, message.presence); return; }
    this.apply({ kind: 'message', token: ws.data.token, message });
  }

  /** Guarda a presença mais recente deste token e a repassa agora, se a janela abriu, ou quando abrir. */
  private relayPresence(token: string, presence: Presence) {
    if (!this.state.members.some((m) => m.token === token)) return; // visitante sem apelido não está na mesa
    let p = this.presences.get(token);
    if (!p) { p = { latest: presence, sentAt: -Infinity }; this.presences.set(token, p); }
    p.latest = presence;
    if (p.handle) return; // a mais recente sai quando o timer vencer
    const now = Date.now();
    const wait = p.sentAt + this.presenceInterval - now;
    if (wait <= 0) { this.flushPresence(token, now); return; }
    p.handle = setTimeout(() => { p.handle = undefined; this.flushPresence(token, Date.now()); }, wait);
  }

  private flushPresence(token: string, now: number) {
    const p = this.presences.get(token);
    const member = this.state.members.find((m) => m.token === token);
    if (!p || !member) return;
    p.sentAt = now;
    const raw = JSON.stringify({ type: 'presence', member: member.id, presence: p.latest });
    for (const [t, ws] of this.sockets) if (t !== token) ws.send(raw);
  }

  private forgetPresence(token: string) {
    const p = this.presences.get(token);
    if (p?.handle) clearTimeout(p.handle);
    this.presences.delete(token);
  }

  private apply(input: RoomInput) {
    const now = Date.now();
    const { state, out, events } = step(this.state, input, now);
    this.state = state;
    for (const o of out) this.sockets.get(o.to)?.send(JSON.stringify(o.message));
    for (const e of events) {
      const { type, ...fields } = e;
      this.log(`room.${type}`, { room: this.code, ...fields });
    }
    if (state.phase === 'dead') {
      for (const ws of this.sockets.values()) { this.clearSilence(ws); ws.close(CLOSE_ROOM_ENDED, 'sala encerrada por inatividade'); }
      this.sockets.clear();
      for (const token of this.presences.keys()) this.forgetPresence(token);
    }
    this.syncTimers(now);
    if (state.phase === 'dead') this.onDead(this.code);
  }

  /** Cancela todo timer e deixa a sala como está: para um teste (ou o processo) terminar sem nada pendente. */
  dispose() {
    for (const h of this.handles.values()) clearTimeout(h);
    this.handles.clear();
    for (const ws of this.sockets.values()) this.clearSilence(ws);
    for (const token of this.presences.keys()) this.forgetPresence(token);
  }

  /** Tira o socket da sala; `since` = desde quando ele estava mudo, quando foi o silêncio que o derrubou. */
  private drop(ws: Socket, since?: number) {
    this.clearSilence(ws);
    if (this.sockets.get(ws.data.token) !== ws) return; // já substituído por outra aba, ou já derrubado pelo silêncio
    this.sockets.delete(ws.data.token);
    this.forgetPresence(ws.data.token);
    this.apply(since === undefined ? { kind: 'disconnect', token: ws.data.token } : { kind: 'disconnect', token: ws.data.token, since });
  }

  /** Este socket deu sinal de vida: o silêncio dele recomeça a contar do zero. */
  private resetSilence(ws: Socket) {
    this.clearSilence(ws);
    const heardAt = Date.now();
    const handle = setTimeout(() => {
      this.silences.delete(ws);
      this.log('room.silent', { room: this.code, token: ws.data.token.slice(0, 8) });
      this.drop(ws, heardAt);
      ws.terminate();
    }, this.silence);
    this.silences.set(ws, { handle, heardAt });
  }

  private clearSilence(ws: Socket) {
    const s = this.silences.get(ws);
    if (s) { clearTimeout(s.handle); this.silences.delete(ws); }
  }

  /** Agenda o que a sala pede e cancela o que ela deixou de pedir; cada timer é identificado pelo seu conteúdo. */
  private syncTimers(now: number) {
    const wanted = new Map(this.state.timers.map((t) => [timerKey(t), t] as const));
    for (const [key, handle] of this.handles) if (!wanted.has(key)) { clearTimeout(handle); this.handles.delete(key); }
    for (const [key, timer] of wanted) {
      if (this.handles.has(key)) continue;
      this.handles.set(key, setTimeout(() => { this.handles.delete(key); this.apply({ kind: 'timer', timer }); }, Math.max(0, timer.at - now)));
    }
  }
}
