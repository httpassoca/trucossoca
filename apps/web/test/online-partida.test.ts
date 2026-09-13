import { describe, expect, test } from 'bun:test';
import { parseClientMessage, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { teamOf, type GameEvent, type Seat } from '@truco/rules';
import { createRoom, step, timerKey, type RoomInput, type RoomState, type RoomTimer } from '../../server/src/room';
import { RemoteTable, type SocketLike } from '../src/lib/table/remote';
import type { Table, TableSnapshot } from '../src/lib/table/table';
import { ManualClock } from './manual-clock';
import { seeded } from './seeded';

/**
 * A sala de verdade (`step`) atrás de sockets falsos: cada mensagem atravessa o cano num timer de zero,
 * como pela rede, e os timers que a sala pede vencem no mesmo relógio manual. Sem servidor, sem porta.
 */
class Pipe {
  state: RoomState;
  private readonly sockets = new Map<string, PipeSocket>();
  private readonly handles = new Map<string, unknown>();
  private readonly rng = seeded(11);
  constructor(private readonly clock: ManualClock) {
    this.state = createRoom('ABCD', clock.now, { botDelay: 50, handPause: 100 });
    this.syncTimers();
  }
  open(url: string): SocketLike {
    const token = new URL(url).searchParams.get('token')!;
    const ws = new PipeSocket(this, token);
    this.sockets.set(token, ws);
    this.clock.setTimeout(() => { ws.onopen?.({}); this.apply({ kind: 'connect', token }); }, 0);
    return ws;
  }
  fromClient(token: string, raw: string) {
    const message = parseClientMessage(raw); if (!message) throw new Error(`mensagem fora do protocolo: ${raw}`);
    this.clock.setTimeout(() => this.apply({ kind: 'message', token, message }), 0);
  }
  private apply(input: RoomInput) {
    const r = step(this.state, input, this.clock.now, { rng: this.rng });
    this.state = r.state;
    for (const o of r.out) this.clock.setTimeout(() => this.sockets.get(o.to)?.deliver(o.message), 0);
    this.syncTimers();
  }
  private syncTimers() {
    const wanted = new Map(this.state.timers.map((t) => [timerKey(t), t] as const));
    for (const [key, handle] of this.handles) if (!wanted.has(key)) { this.clock.clearTimeout(handle); this.handles.delete(key); }
    for (const [key, timer] of wanted) {
      if (this.handles.has(key)) continue;
      this.handles.set(key, this.clock.setTimeout(() => { this.handles.delete(key); this.apply({ kind: 'timer', timer: timer as RoomTimer }); }, Math.max(0, timer.at - this.clock.now)));
    }
  }
}

class PipeSocket implements SocketLike {
  received: ServerMessage[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(private readonly pipe: Pipe, private readonly token: string) {}
  send(data: string) { this.pipe.fromClient(this.token, data); }
  close() { this.onclose?.({ code: 1005, reason: '' }); }
  deliver(message: ServerMessage) { this.received.push(message); this.onmessage?.({ data: JSON.stringify(message) }); }
  get snapshots() { return this.received.filter((m): m is ServerMessage & { type: 'snapshot' } => m.type === 'snapshot').map((m) => m.snapshot); }
  get events() { return this.received.filter((m): m is ServerMessage & { type: 'events' } => m.type === 'events').flatMap((m) => m.events); }
  get errors() { return this.received.filter((m) => m.type === 'error'); }
}

/** Uma pessoa na cadeira: joga a primeira carta (trucando na 1ª vaza quando pode), aceita truco, joga a mão de dez. */
function person(table: Table, clock: ManualClock) {
  const check = (snap: TableSnapshot) => {
    if (!snap.game.hand || snap.game.over || snap.acting !== snap.seat) return;
    clock.setTimeout(() => {
      const s = table.snapshot, h = s.game.hand!;
      if (s.acting !== s.seat || h.phase === 'over') return;
      if (h.phase === 'dezDecision') table.decideDez('play');
      else if (h.phase === 'respond') table.respond('accept');
      else if (h.turn === s.seat) {
        if (s.canRaise && h.played.length === 1) table.raise();
        else table.play(h.cards[s.seat!][0]!);
      }
    }, 0);
  };
  check(table.snapshot); // a vez pode já ser desta pessoa
  return table.subscribe(check);
}

function member(pipe: Pipe, clock: ManualClock, token: string) {
  const sockets: PipeSocket[] = [];
  const table = new RemoteTable({ url: 'ws://x/ws', room: 'abcd', token }, { socket: (url) => { const s = pipe.open(url) as PipeSocket; sockets.push(s); return s; }, clock });
  table.connect();
  return { table, get socket() { return sockets[sockets.length - 1]; } };
}

describe('partida online pelo cano: RemoteTable ↔ sala', () => {
  test('duas pessoas e dois bots atravessam o lobby, uma partida inteira e a revanche; cada uma só vê as suas cartas', () => {
    const clock = new ManualClock();
    const pipe = new Pipe(clock);
    const ze = member(pipe, clock, 'token-ze'), dita = member(pipe, clock, 'token-dita');
    const room = (m: { table: RemoteTable }) => m.table.state.room;
    const settle = () => clock.settle();

    // lobby: entrar, sentar em duplas diferentes, começar
    settle();
    ze.table.join('Zé'); dita.table.join('Dita'); settle();
    expect(room(ze)!.members.map((m) => m.nickname)).toEqual(['Zé', 'Dita']);
    ze.table.takeSeat(0); dita.table.takeSeat(1); settle();
    expect(ze.table.snapshot.seat).toBe(0);
    expect(dita.table.snapshot.seat).toBe(1);
    ze.table.start();
    clock.runUntil(() => room(ze)?.phase === 'playing' && room(dita)?.phase === 'playing');
    expect(ze.table.snapshot.seats.map((s) => [s.name, s.bot])).toEqual([['Zé', false], ['Dita', false], ['Tião', true], ['Nena', true]]);

    // a partida: as pessoas agem no que veem; bots e mãos novas vencem no relógio
    const seen: Record<string, GameEvent[]> = { ze: [], dita: [] };
    ze.table.subscribe((_s, ev) => seen.ze.push(...ev));
    dita.table.subscribe((_s, ev) => seen.dita.push(...ev));
    person(ze.table, clock); person(dita.table, clock);
    clock.runUntil(() => ze.table.snapshot.game.over && dita.table.snapshot.game.over, 5_000);

    const g = ze.table.snapshot.game;
    expect(g.scores).toEqual(dita.table.snapshot.game.scores);
    expect(g.scores[g.winner!]).toBeGreaterThanOrEqual(g.rules.target);
    expect(seen.ze.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    expect(seen.ze.filter((e) => e.type === 'newHand')).toHaveLength(g.handNo);
    expect(seen.ze.filter((e) => e.type === 'play' && e.seat === 0).length).toBeGreaterThan(0);
    expect(seen.dita.filter((e) => e.type === 'play' && e.seat === 1).length).toBeGreaterThan(0);
    expect(seen.ze.some((e) => e.type === 'raise')).toBe(true);
    // os dois viram a mesma partida: os mesmos eventos na mesma ordem, com as mesmas sementes (só a coberta alheia perde o id)
    const strip = (ev: GameEvent[]) => ev.map((e) => (e.type === 'play' ? { ...e, id: e.covered ? null : e.id } : e));
    expect(strip(seen.dita)).toEqual(strip(seen.ze));
    expect(ze.socket.errors).toEqual([]);
    expect(dita.socket.errors).toEqual([]);

    // em nenhum snapshot alguém recebeu as cartas de outra cadeira (fora as do parceiro na decisão da mão de dez)
    for (const [m, seat] of [[ze, 0], [dita, 1]] as [typeof ze, Seat][]) {
      const snaps = m.socket.snapshots.filter((s: RoomSnapshot) => s.game?.hand);
      expect(snaps.length).toBeGreaterThan(30);
      for (const snap of snaps) {
        const h = snap.game!.hand!;
        for (const other of [0, 1, 2, 3] as Seat[]) {
          if (other === seat) continue;
          const peek = h.phase === 'dezDecision' && h.revealPartner && h.decider === teamOf(seat) && other === (seat + 2) % 4;
          if (!peek) expect(h.cards[other].every((c) => c === null)).toBe(true);
        }
        for (const trick of h.played) for (const p of trick) if (p.covered && p.seat !== seat) expect(p.id).toBeNull();
      }
    }

    // revanche: a sala volta ao lobby com as mesmas cadeiras
    expect(ze.table.snapshot.restart).toBe('rematch');
    ze.table.newGame();
    clock.runUntil(() => room(ze)?.phase === 'lobby' && room(dita)?.phase === 'lobby');
    expect(room(dita)!.members.map((m) => [m.nickname, m.seat, m.bot])).toEqual([['Zé', 0, false], ['Dita', 1, false]]);
    expect(dita.table.snapshot.game.hand).toBeNull();
    expect(dita.table.snapshot.seat).toBe(1);
  });
});
