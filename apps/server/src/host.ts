import { CLOSE_REPLACED, CLOSE_ROOM_ENDED, parseClientMessage } from '@truco/protocol';
import type { ServerWebSocket } from 'bun';
import type { Log } from './log';
import { createRoom, DEFAULT_PACE, step, timerKey, type RoomInput, type RoomPace, type RoomState } from './room';

export interface SocketData { code: string; token: string }
export type Socket = ServerWebSocket<SocketData>;

/**
 * Adaptador de uma sala: guarda os sockets por token, entrega as mensagens que a sala manda e agenda
 * os timers que ela pede (`state.timers`), nunca os seus. Quando a sala morre, fecha todo mundo e avisa.
 */
export class RoomHost {
  state: RoomState;
  private readonly sockets = new Map<string, Socket>();
  private readonly handles = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(code: string, private readonly log: Log, private readonly onDead: (code: string) => void, now = Date.now(), pace: RoomPace = DEFAULT_PACE) {
    this.state = createRoom(code, now, pace);
    this.syncTimers(now);
    log('room.created', { room: code });
  }

  get code() { return this.state.code; }
  get connections() { return this.sockets.size; }

  connect(ws: Socket) {
    const prev = this.sockets.get(ws.data.token);
    this.sockets.set(ws.data.token, ws);
    // mesma pessoa, socket novo (aba duplicada, ou voltou antes de o servidor notar a queda): o velho sai sem avisar a sala
    if (prev && prev !== ws) prev.close(CLOSE_REPLACED, 'outra aba assumiu');
    this.apply({ kind: 'connect', token: ws.data.token }); // para quem já está conectado, a sala só reenvia o snapshot
  }

  disconnect(ws: Socket) {
    if (this.sockets.get(ws.data.token) !== ws) return; // já substituído por outra aba
    this.sockets.delete(ws.data.token);
    this.apply({ kind: 'disconnect', token: ws.data.token });
  }

  message(ws: Socket, raw: string | Buffer) {
    const message = parseClientMessage(typeof raw === 'string' ? raw : raw.toString());
    if (!message) { this.log('room.badMessage', { room: this.code, token: ws.data.token.slice(0, 8) }); return; }
    this.apply({ kind: 'message', token: ws.data.token, message });
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
      for (const ws of this.sockets.values()) ws.close(CLOSE_ROOM_ENDED, 'sala encerrada por inatividade');
      this.sockets.clear();
    }
    this.syncTimers(now);
    if (state.phase === 'dead') this.onDead(this.code);
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
