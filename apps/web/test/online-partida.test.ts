import { describe, expect, test } from 'bun:test';
import { parseClientMessage, SOCKET_IDLE_TIMEOUT, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { teamOf, type GameEvent, type Seat } from '@truco/rules';
import { createRoom, DISCONNECT_GRACE, step, timerKey, type RoomInput, type RoomState, type RoomTimer } from '../../server/src/room';
import { RemoteTable, type SocketLike } from '../src/lib/table/remote';
import type { Table, TableSnapshot } from '../src/lib/table/table';
import { ManualClock } from './manual-clock';
import { seeded } from './seeded';

/**
 * A sala de verdade (`step`) atrás de sockets falsos: cada mensagem atravessa o cano num timer de zero,
 * como pela rede, e os timers que a sala pede vencem no mesmo relógio manual. Sem servidor, sem porta.
 * Como o host, derruba quem fica `SOCKET_IDLE_TIMEOUT` sem mandar nada, contando a tolerância desde o último sinal,
 * e repassa a presença de cada membro aos outros sockets por fora da sala.
 */
class Pipe {
  state: RoomState;
  private readonly sockets = new Map<string, PipeSocket>();
  private readonly handles = new Map<string, unknown>();
  private readonly silences = new Map<PipeSocket, { handle: unknown; heardAt: number }>();
  private readonly rng = seeded(11);
  constructor(private readonly clock: ManualClock) {
    this.state = createRoom('ABCD', clock.now, { botDelay: 50, handPause: 100 });
    this.syncTimers();
  }
  open(url: string): SocketLike {
    const token = new URL(url).searchParams.get('token')!;
    const ws = new PipeSocket(this, token);
    this.sockets.set(token, ws);
    this.clock.setTimeout(() => { ws.onopen?.({}); this.heard(ws); this.apply({ kind: 'connect', token }); }, 0);
    return ws;
  }
  /** A rede desta pessoa morreu sem fechar nada: o socket vira um buraco (nada sai, nada chega); só o silêncio denuncia. */
  drop(token: string) { const ws = this.sockets.get(token); if (ws) ws.dead = true; }
  fromClient(ws: PipeSocket, token: string, raw: string) {
    const message = parseClientMessage(raw); if (!message) throw new Error(`mensagem fora do protocolo: ${raw}`);
    this.heard(ws);
    if (message.type === 'presence') {
      const member = this.state.members.find((m) => m.token === token); if (!member) return;
      for (const [t, other] of this.sockets) if (t !== token) this.clock.setTimeout(() => other.deliver({ type: 'presence', member: member.id, presence: message.presence }), 0);
      return;
    }
    this.clock.setTimeout(() => this.apply({ kind: 'message', token, message }), 0);
  }
  private heard(ws: PipeSocket) {
    const prev = this.silences.get(ws); if (prev) this.clock.clearTimeout(prev.handle);
    const heardAt = this.clock.now;
    const handle = this.clock.setTimeout(() => {
      this.silences.delete(ws);
      if (this.sockets.get(ws.token) !== ws) return;
      this.sockets.delete(ws.token);
      this.apply({ kind: 'disconnect', token: ws.token, since: heardAt });
    }, SOCKET_IDLE_TIMEOUT);
    this.silences.set(ws, { handle, heardAt });
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
  sent: unknown[] = [];
  dead = false;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(private readonly pipe: Pipe, readonly token: string) {}
  send(data: string) { this.sent.push(JSON.parse(data)); if (!this.dead) this.pipe.fromClient(this, this.token, data); }
  close() { this.onclose?.({ code: 1005, reason: '' }); }
  deliver(message: ServerMessage) { if (this.dead) return; this.received.push(message); this.onmessage?.({ data: JSON.stringify(message) }); }
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

  test('quem perde a rede no meio da partida: um bot joga por ela em vinte segundos, e ao voltar ela retoma sem recarregar', () => {
    const clock = new ManualClock();
    const pipe = new Pipe(clock);
    const ze = member(pipe, clock, 'token-ze'), dita = member(pipe, clock, 'token-dita');
    const room = (m: { table: RemoteTable }) => m.table.state.room;
    const ditaSeen = (m: { table: RemoteTable }) => room(m)!.members.find((x) => x.nickname === 'Dita')!;
    clock.settle();
    ze.table.join('Zé'); dita.table.join('Dita'); clock.settle();
    ze.table.takeSeat(0); dita.table.takeSeat(1); clock.settle();
    ze.table.start();
    clock.runUntil(() => room(ze)?.phase === 'playing' && room(dita)?.phase === 'playing');
    const seen: GameEvent[] = [];
    ze.table.subscribe((_s, ev) => seen.push(...ev));
    person(ze.table, clock);
    const statuses: string[] = [];
    dita.table.watch((s) => { if (statuses[statuses.length - 1] !== s.status) statuses.push(s.status); });

    // a rede de Dita morre: a aba dela não nota nada na hora, mas o servidor sim
    const ditaSocket = dita.socket;
    const t0 = clock.now;
    pipe.drop('token-dita');
    expect(dita.table.state.status).toBe('open');
    clock.runUntil(() => ditaSeen(ze).botControlled);
    // o servidor só nota pelo silêncio (30 s desde o último ping), e a tolerância de 20 s já passou: o bot entra na hora
    expect(clock.now - t0).toBeLessThanOrEqual(SOCKET_IDLE_TIMEOUT);
    expect(clock.now - t0).toBeGreaterThan(DISCONNECT_GRACE);
    expect(ditaSeen(ze)).toMatchObject({ seat: 1, connected: false, bot: false, botControlled: true });
    expect(ze.table.snapshot.seats[1]).toEqual({ name: 'Dita', bot: false, botControlled: true });
    // e o bot joga pela cadeira 1
    const before = seen.length;
    clock.runUntil(() => seen.slice(before).some((e) => e.type === 'play' && e.seat === 1) || ze.table.snapshot.game.over);
    expect(ze.table.snapshot.game.over).toBe(false);

    // a aba de Dita nota o silêncio, reconecta sozinha e retoma a cadeira; a partida segue com ela
    clock.runUntil(() => dita.socket !== ditaSocket && dita.table.state.status === 'open' && !ditaSeen(dita).botControlled);
    clock.settle(); // o snapshot da retomada chega a Zé pelo cano
    expect(clock.now - t0).toBeLessThanOrEqual(SOCKET_IDLE_TIMEOUT + 1_000); // a aba nota o silêncio no mesmo prazo e volta com a espera mínima
    expect(statuses).toEqual(['reconnecting', 'open']); // ela passou por "sem conexão" e voltou
    expect(dita.table.snapshot.seat).toBe(1);
    expect(ditaSeen(ze)).toMatchObject({ connected: true, botControlled: false });
    expect(ze.table.snapshot.seats[1]).toEqual({ name: 'Dita', bot: false, botControlled: false });
    const h = dita.table.snapshot.game.hand!;
    if (h.phase !== 'over') expect(h.cards[1].some((c) => c !== null)).toBe(true);
    for (const other of [0, 2, 3] as const) expect(h.cards[other].every((c) => c === null)).toBe(true);
    person(dita.table, clock);
    clock.runUntil(() => ze.table.snapshot.game.over && dita.table.snapshot.game.over, 5_000);
    expect(ze.table.snapshot.game.scores).toEqual(dita.table.snapshot.game.scores);
    expect(dita.socket.errors).toEqual([]);
    expect(ditaSocket.dead).toBe(true);
  });

  test('fantasma: os outros veem onde ela anda e para onde os sentados olham, ela não joga, e entre mãos senta no lugar de um bot', () => {
    const clock = new ManualClock();
    const pipe = new Pipe(clock);
    const ze = member(pipe, clock, 'token-ze'), dita = member(pipe, clock, 'token-dita'), nena = member(pipe, clock, 'token-nena');
    const room = (m: { table: RemoteTable }) => m.table.state.room;
    clock.settle();
    ze.table.join('Zé'); dita.table.join('Dita'); nena.table.join('Nena'); clock.settle();
    ze.table.takeSeat(0); dita.table.takeSeat(1); clock.settle();
    ze.table.start();
    clock.runUntil(() => [ze, dita, nena].every((m) => room(m)?.phase === 'playing'));
    expect(nena.table.snapshot.seat).toBeNull();
    expect(nena.table.snapshot.ghosts).toEqual([]);
    expect(ze.table.snapshot.ghosts).toEqual([{ id: 'm3', name: 'Nena', connected: true }]);
    // o toggle da sala: fantasma vê as cartas de todo mundo
    expect(nena.table.snapshot.game.hand!.cards.every((held) => held.every((c) => c !== null))).toBe(true);

    // presença: a dela chega aos outros dois (nunca a ela); a de quem senta chega a ela, por cadeira
    const walk = { x: 2, y: 0, z: 3, yaw: 1, pitch: 0 }, gaze = { x: 0, y: 0, z: 1.45, yaw: 0.2, pitch: -0.4 };
    nena.table.setPresence(walk); ze.table.setPresence(gaze); clock.settle();
    expect(ze.table.presenceOf('m3')).toEqual(walk);
    expect(dita.table.presenceOf('m3')).toEqual(walk);
    expect(nena.table.presenceOf('m3')).toBeUndefined();
    expect(nena.table.presenceOf(0)).toEqual(gaze);
    expect(nena.table.presenceOf(1)).toBeUndefined();

    // nenhuma jogada de fantasma passa
    const before = structuredClone(pipe.state.game);
    nena.table.play('4c'); nena.table.raise(); nena.table.respond('accept'); nena.table.decideDez('play'); clock.settle();
    expect(nena.socket.errors.map((e) => (e as { reason: string }).reason)).toEqual(['notSeated', 'notSeated', 'notSeated', 'notSeated']);
    expect(pipe.state.game).toEqual(before);

    // ela quer a cadeira do Tião (2) no meio da mão: a intenção espera; a mão acaba e ela senta, na dupla de Zé
    nena.table.takeBotSeat(2);
    expect(nena.table.state.wantsSeat).toBe(2);
    expect(nena.socket.sent).not.toContainEqual(expect.objectContaining({ type: 'takeBotSeat' }));
    person(ze.table, clock); person(dita.table, clock);
    clock.runUntil(() => nena.table.snapshot.seat === 2, 5_000);
    expect(nena.table.state.wantsSeat).toBeNull();
    expect(pipe.state.game!.hand!.phase).toBe('over'); // sentou na pausa, antes da mão seguinte
    clock.settle(); // o snapshot chega aos outros pelo cano
    expect(ze.table.snapshot.seats.map((s) => [s.name, s.bot])).toEqual([['Zé', false], ['Dita', false], ['Nena', false], ['Bastião', true]]);
    expect(ze.table.snapshot.ghosts).toEqual([]);
    // dali em diante ela é uma cadeira como as outras: só as próprias cartas, e joga
    person(nena.table, clock);
    clock.runUntil(() => nena.table.snapshot.game.hand!.phase !== 'over', 5_000);
    const h = nena.table.snapshot.game.hand!;
    expect(h.cards[2].every((c) => c !== null)).toBe(true);
    for (const other of [0, 1, 3] as const) expect(h.cards[other].every((c) => c === null)).toBe(true);
    clock.runUntil(() => [ze, dita, nena].every((m) => m.table.snapshot.game.over), 5_000);
    expect(nena.table.snapshot.game.scores).toEqual(ze.table.snapshot.game.scores);
    // Zé e Nena são dupla: os dois respondem ao truco e a segunda resposta é recusada (o snapshot vale); fora isso, nada foi recusado
    expect(nena.socket.errors.slice(4).filter((e) => (e as { action: string }).action !== 'respond')).toEqual([]);
  });
});
