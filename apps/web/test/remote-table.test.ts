import { describe, expect, test } from 'bun:test';
import { CLOSE_ROOM_ENDED, CLOSE_ROOM_NOT_FOUND, PING_INTERVAL, type RoomSnapshot } from '@truco/protocol';
import { createGame, defaultRules, startHand, viewFor, type GameEvent, type GameView } from '@truco/rules';
import { BACKOFF_MAX, RemoteTable, type RemoteState, type SocketLike } from '../src/lib/table/remote';
import type { TableSnapshot } from '../src/lib/table/table';
import { ManualClock } from './manual-clock';

/** Socket falso: guarda o que o cliente mandou e deixa o teste fazer o papel do servidor. */
class FakeSocket implements SocketLike {
  sent: unknown[] = [];
  closedBy: { code?: number } | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {}
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number) { this.closedBy = { code }; this.onclose?.({ code: 1005, reason: '' }); }
  open() { this.onopen?.(); }
  receive(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  serverClose(code: number, reason = '') { this.onclose?.({ code, reason }); }
}

type Member = RoomSnapshot['members'][number];
const human = (id: string, nickname: string, seat: Member['seat'] = null): Member => ({ id, nickname, connected: true, seat, bot: false });
const bot = (id: string, nickname: string, seat: Member['seat']): Member => ({ id, nickname, connected: true, seat, bot: true });
const lobby = (members: Member[], you: string | null, patch: Partial<RoomSnapshot> = {}): RoomSnapshot =>
  ({ code: 'ABCD', phase: 'lobby', members, you, teams: ['Nós', 'Eles'], rules: defaultRules, ghostsSeeCards: true, game: null, ...patch });

/** Uma mesa em curso como o servidor a mandaria para quem senta na cadeira 1 (ou para um fantasma). */
function playing(viewer: 1 | 'all') {
  const g = createGame(); startHand(g, () => 0.5);
  const members = [bot('m1', 'Tião', 0), human('m2', 'Zé', 1), bot('m3', 'Nena', 2), bot('m4', 'Bastião', 3), human('m5', 'Dita')];
  const game: GameView = viewFor(g, viewer);
  return { real: g, snapshot: lobby(members, viewer === 1 ? 'm2' : 'm5', { phase: 'playing', game }) };
}

function setup() {
  const clock = new ManualClock();
  const sockets: FakeSocket[] = [];
  const states: RemoteState[] = [];
  const table = new RemoteTable({ url: 'ws://x/ws', room: 'abcd', token: 'tok-1' }, { socket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; }, clock });
  table.watch((s) => states.push(s));
  return { clock, sockets, states, table, last: () => sockets[sockets.length - 1] };
}

describe('RemoteTable: conexão', () => {
  test('conecta com sala e token na URL e aplica o snapshot', () => {
    const { table, sockets, last } = setup();
    table.connect();
    expect(sockets).toHaveLength(1);
    expect(last().url).toBe('ws://x/ws?room=ABCD&token=tok-1');
    expect(table.state.status).toBe('connecting');
    last().open();
    expect(table.state.status).toBe('open');
    last().receive({ type: 'snapshot', snapshot: lobby([human('m1', 'Zé')], null) });
    expect(table.state.room?.members.map((m) => m.nickname)).toEqual(['Zé']);
    expect(table.state.room?.you).toBeNull();
  });

  test('entrar e trocar de apelido viram mensagens do protocolo', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    table.join('Zé');
    table.setNickname('Dita');
    expect(last().sent).toEqual([{ type: 'join', nickname: 'Zé' }, { type: 'nickname', nickname: 'Dita' }]);
  });

  test('manda ping no intervalo enquanto está aberto', () => {
    const { table, last, clock } = setup();
    table.connect(); last().open();
    clock.step();
    expect(last().sent).toEqual([{ type: 'ping' }]);
    expect(clock.now).toBe(PING_INTERVAL);
    clock.step();
    expect(last().sent).toHaveLength(2);
    const old = last();
    old.serverClose(1006);
    clock.step(); // só a reconexão vence; o socket velho não recebe mais ping
    expect(old.sent).toHaveLength(2);
    expect(last()).not.toBe(old);
  });
});

describe('RemoteTable: lobby', () => {
  test('as ações do lobby viram mensagens do protocolo', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const rules = { ...defaultRules, allowCovered: false };
    table.takeSeat(1); table.leaveSeat(); table.renameTeam(0, 'Os Bão'); table.setRules(rules); table.setGhostsSeeCards(false); table.start();
    expect(last().sent).toEqual([
      { type: 'takeSeat', team: 1 }, { type: 'leaveSeat' }, { type: 'renameTeam', team: 0, name: 'Os Bão' },
      { type: 'rules', rules }, { type: 'ghostsSeeCards', on: false }, { type: 'start' },
    ]);
  });

  test('no lobby a mesa está vazia: sem mão e ninguém agindo; a cadeira escolhida já aparece', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    last().receive({ type: 'snapshot', snapshot: lobby([human('m1', 'Zé', 2)], 'm1') });
    const snap = table.snapshot;
    expect(snap.game.hand).toBeNull();
    expect(snap.seat).toBe(2);
    expect(snap.acting).toBe(-1);
    expect(snap.canRaise).toBe(false);
  });
});

describe('RemoteTable: a mesa', () => {
  test('quem está sentado vê a própria cadeira, os nomes por cadeira, as duplas e só as próprias cartas', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { real, snapshot } = playing(1);
    last().receive({ type: 'snapshot', snapshot });
    const snap = table.snapshot;
    expect(snap.seat).toBe(1);
    expect(snap.seats.map((s) => [s.name, s.bot])).toEqual([['Tião', true], ['Zé', false], ['Nena', true], ['Bastião', true]]);
    expect(snap.teams).toEqual(['Nós', 'Eles']);
    expect(snap.game.hand!.cards[1]).toEqual(real.hand!.cards[1]);
    expect(snap.game.hand!.cards[0]).toEqual([null, null, null]);
    expect(snap.game.hand!.stock).toBe(28);
    expect(snap.acting).toBe(real.hand!.turn);
    expect(snap.canRaise).toBe(real.hand!.turn === 1);
  });

  test('fantasma não tem cadeira, não truca e não é esperado por ninguém', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { real, snapshot } = playing('all');
    last().receive({ type: 'snapshot', snapshot });
    const snap = table.snapshot;
    expect(snap.seat).toBeNull();
    expect(snap.canRaise).toBe(false);
    expect(snap.acting).toBe(real.hand!.turn);
    expect(snap.game.hand!.cards).toEqual(real.hand!.cards);
  });

  test('os eventos da mesa chegam ao ouvinte junto com o snapshot seguinte, e um snapshot só vem sem eventos', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const got: [TableSnapshot, GameEvent[]][] = [];
    table.subscribe((s, ev) => got.push([s, ev]));
    const { snapshot } = playing(1);
    const events: GameEvent[] = [{ type: 'newHand', mao: 0, special: 'normal', value: 2, decider: null }];
    last().receive({ type: 'events', events });
    expect(got).toHaveLength(0);
    last().receive({ type: 'snapshot', snapshot });
    expect(got).toHaveLength(1);
    expect(got[0][1]).toEqual(events);
    expect(got[0][0]).toBe(table.snapshot);
    last().receive({ type: 'snapshot', snapshot });
    expect(got[1][1]).toEqual([]);
  });

  test('quem assina depois do começo recebe na hora os eventos que ninguém ouviu, uma vez só', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    const events: GameEvent[] = [{ type: 'newHand', mao: 0, special: 'normal', value: 2, decider: null }];
    last().receive({ type: 'events', events });
    last().receive({ type: 'snapshot', snapshot });
    const got: GameEvent[][] = [];
    table.subscribe((_s, ev) => got.push(ev));
    expect(got).toEqual([events]);
    table.subscribe((_s, ev) => got.push(ev));
    expect(got).toEqual([events]);
  });

  test('cobrir a próxima carta é uma intenção local: liga só quando a regra permite', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    last().receive({ type: 'snapshot', snapshot });
    table.toggleCover();
    expect(table.snapshot.coverNext).toBe(false); // 1ª vaza
    const later = structuredClone(snapshot);
    later.game!.hand!.played.push([]);
    last().receive({ type: 'snapshot', snapshot: later });
    table.toggleCover();
    expect(table.snapshot.coverNext).toBe(true);
  });
});

describe('RemoteTable: reconexão', () => {
  test('queda inesperada reconecta com espera crescente até o teto, e zera ao abrir', () => {
    const { table, sockets, last, clock } = setup();
    table.connect(); last().open();
    last().serverClose(1006);
    expect(table.state.status).toBe('reconnecting');
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = clock.now;
      clock.step(); // vence a espera; abre um socket novo
      waits.push(clock.now - before);
      last().serverClose(1006);
    }
    expect(waits).toEqual([500, 1000, 2000, 4000, 8000, BACKOFF_MAX, BACKOFF_MAX]);
    expect(sockets).toHaveLength(8);
    clock.step(); last().open();
    expect(table.state.status).toBe('open');
    expect(table.state.attempt).toBe(0);
  });

  test('sala inexistente ou encerrada fecha de vez, sem reconectar', () => {
    for (const [code, reason] of [[CLOSE_ROOM_NOT_FOUND, 'room-not-found'], [CLOSE_ROOM_ENDED, 'room-ended']] as const) {
      const { table, last, clock, sockets } = setup();
      table.connect(); last().open();
      last().serverClose(code);
      expect(table.state.status).toBe('closed');
      expect(table.state.reason).toBe(reason);
      clock.run();
      expect(sockets).toHaveLength(1);
    }
  });

  test('se a sala esqueceu a pessoa enquanto ela caiu, entra de novo com o mesmo apelido', () => {
    const { table, last, clock } = setup();
    table.connect(); last().open();
    table.join('Zé');
    last().receive({ type: 'snapshot', snapshot: lobby([human('m1', 'Zé')], 'm1') });
    last().serverClose(1006);
    clock.step(); last().open();
    last().receive({ type: 'snapshot', snapshot: lobby([], null) });
    expect(last().sent).toEqual([{ type: 'join', nickname: 'Zé' }]);
  });

  test('dispose fecha o socket e não deixa timer nenhum', () => {
    const { table, last, clock } = setup();
    table.connect(); last().open();
    table.dispose();
    expect(last().closedBy).not.toBeNull();
    expect(clock.pending).toBe(0);
    expect(table.state.status).toBe('closed');
  });
});
