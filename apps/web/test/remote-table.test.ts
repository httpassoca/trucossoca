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
const human = (id: string, nickname: string, seat: Member['seat'] = null): Member => ({ id, nickname, connected: true, seat, bot: false, botControlled: false, idle: 0 });
const bot = (id: string, nickname: string, seat: Member['seat']): Member => ({ id, nickname, connected: true, seat, bot: true, botControlled: false, idle: 0 });
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
    last().receive({ type: 'pong' });
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

  test('a cadeira de quem caiu ou ficou parada mostra que um bot joga por ela; passar uma cadeira vira mensagem', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    snapshot.members[4] = { ...snapshot.members[4], seat: 3, connected: false, botControlled: true };
    snapshot.members[3] = { ...snapshot.members[3], seat: null };
    last().receive({ type: 'snapshot', snapshot });
    expect(table.snapshot.seats.map((s) => [s.name, s.bot, s.botControlled])).toEqual([['Tião', true, false], ['Zé', false, false], ['Nena', true, false], ['Dita', false, true]]);
    table.handToBot('m5');
    expect(last().sent).toEqual([{ type: 'handToBot', member: 'm5' }]);
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

  test('um ping sem resposta nenhuma até o ping seguinte derruba o socket e reconecta; qualquer mensagem do servidor conta como resposta', () => {
    const { table, last, clock, sockets } = setup();
    table.connect(); last().open();
    const first = last();
    clock.step(); // 1º ping
    first.receive({ type: 'pong' });
    clock.step(); // 2º ping: o 1º foi respondido
    expect(table.state.status).toBe('open');
    first.receive({ type: 'snapshot', snapshot: lobby([], null) });
    clock.step(); // 3º ping: houve um snapshot no meio
    expect(table.state.status).toBe('open');
    clock.step(); // nada chegou desde o 3º ping: a conexão está morta
    expect(first.closedBy).not.toBeNull();
    expect(table.state.status).toBe('reconnecting');
    expect(first.sent.filter((m) => (m as { type: string }).type === 'ping')).toHaveLength(3);
    clock.step(); // a espera venceu: socket novo
    expect(sockets).toHaveLength(2);
    last().open();
    expect(table.state.status).toBe('open');
  });

  test('reconnect() derruba o socket de vez (a rede caiu) e retryNow() tenta na hora quando ela volta', () => {
    const { table, last, clock, sockets } = setup();
    table.connect(); last().open();
    table.reconnect();
    expect(sockets[0].closedBy).not.toBeNull();
    expect(table.state.status).toBe('reconnecting');
    expect(sockets).toHaveLength(1);
    table.retryNow();
    expect(sockets).toHaveLength(2);
    expect(clock.pending).toBe(0);
    last().open();
    expect(table.state.status).toBe('open');
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

describe('RemoteTable: as jogadas', () => {
  test('jogar, trucar, responder e decidir a mão de dez viram mensagens do protocolo pela cadeira local', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    last().receive({ type: 'snapshot', snapshot });
    table.play('4c'); table.play('7h', true); table.raise(); table.respond('decline'); table.decideDez('run');
    expect(last().sent).toEqual([
      { type: 'play', id: '4c', covered: false }, { type: 'play', id: '7h', covered: true }, { type: 'raise' },
      { type: 'respond', action: 'decline' }, { type: 'decideDez', action: 'run' },
    ]);
  });

  test('cobrir a próxima carta vai junto na jogada e desliga quando a própria jogada chega', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    const later = structuredClone(snapshot);
    later.game!.hand!.played.push([]);
    last().receive({ type: 'snapshot', snapshot: later });
    table.toggleCover();
    table.play('4c');
    expect(last().sent).toEqual([{ type: 'play', id: '4c', covered: true }]);
    expect(table.snapshot.coverNext).toBe(true); // até o servidor confirmar
    last().receive({ type: 'events', events: [{ type: 'play', seat: 1, id: '4c', covered: true, kind: 'cover', seed: 7 }] });
    last().receive({ type: 'snapshot', snapshot: later });
    expect(table.snapshot.coverNext).toBe(false);
  });

  test('uma jogada recusada pelo servidor não muda nada aqui', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    last().receive({ type: 'snapshot', snapshot });
    const got: unknown[] = [];
    table.subscribe((s, ev) => got.push([s, ev]));
    const before = table.snapshot;
    last().receive({ type: 'error', action: 'play', reason: 'illegal' });
    expect(table.snapshot).toBe(before);
    expect(got).toEqual([]);
    expect(table.state.status).toBe('open');
  });

  test('no fim de jogo, quem está sentado pode pedir revanche; fantasma não; antes do fim ninguém', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing(1);
    last().receive({ type: 'snapshot', snapshot });
    expect(table.snapshot.restart).toBeNull();
    table.newGame();
    expect(last().sent).toEqual([]);
    const over = structuredClone(snapshot);
    over.game!.over = true; over.game!.winner = 0;
    last().receive({ type: 'snapshot', snapshot: over });
    expect(table.snapshot.restart).toBe('rematch');
    table.newGame();
    expect(last().sent).toEqual([{ type: 'rematch' }]);
    const ghost = playing('all').snapshot;
    ghost.game!.over = true; ghost.game!.winner = 0;
    last().receive({ type: 'snapshot', snapshot: ghost });
    expect(table.snapshot.restart).toBeNull();
  });
});

describe('RemoteTable: fantasmas', () => {
  test('a mesa lista os outros sem cadeira como fantasmas (nunca a própria pessoa)', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing('all'); // eu sou Dita (m5), fantasma
    snapshot.members.push({ ...human('m6', 'Bastião 2'), connected: false });
    last().receive({ type: 'snapshot', snapshot });
    expect(table.snapshot.ghosts).toEqual([{ id: 'm6', name: 'Bastião 2', connected: false }]);
    const seated = playing(1).snapshot; // eu sou Zé (m2), na cadeira 1; Dita assiste
    last().receive({ type: 'snapshot', snapshot: seated });
    expect(table.snapshot.ghosts).toEqual([{ id: 'm5', name: 'Dita', connected: true }]);
  });

  test('a presença dos outros fica disponível por id (fantasma) ou por cadeira, e some com quem sai da sala', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing('all');
    snapshot.members.push(human('m6', 'Bastião 2'));
    last().receive({ type: 'snapshot', snapshot });
    const got: unknown[] = [];
    table.subscribe((s, ev) => got.push([s, ev]));
    const p = { x: 1, y: 0, z: -2, yaw: 0.5, pitch: -0.2 };
    last().receive({ type: 'presence', member: 'm6', presence: p });
    last().receive({ type: 'presence', member: 'm2', presence: { ...p, x: 9 } });
    expect(table.presenceOf('m6')).toEqual(p);
    expect(table.presenceOf(1)).toEqual({ ...p, x: 9 });
    expect(table.presenceOf(0)).toBeUndefined();
    expect(got).toEqual([]); // presença não é uma mudança da mesa
    const gone = structuredClone(snapshot);
    gone.members = gone.members.filter((m) => m.id !== 'm6');
    last().receive({ type: 'snapshot', snapshot: gone });
    expect(table.presenceOf('m6')).toBeUndefined();
    expect(table.presenceOf(1)).toEqual({ ...p, x: 9 });
  });

  test('a própria presença vira mensagem do protocolo', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    table.setPresence({ x: 1, y: 0, z: 2, yaw: 3, pitch: 0 });
    expect(last().sent).toEqual([{ type: 'presence', presence: { x: 1, y: 0, z: 2, yaw: 3, pitch: 0 } }]);
  });

  test('sentar no lugar de um bot: entre mãos vai na hora; no meio da mão fica como intenção e vai quando a mão acabar', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing('all'); // mão em curso
    last().receive({ type: 'snapshot', snapshot });
    table.takeBotSeat(2);
    expect(last().sent).toEqual([]);
    expect(table.state.wantsSeat).toBe(2);
    const paused = structuredClone(snapshot);
    paused.game!.hand!.phase = 'over';
    last().receive({ type: 'snapshot', snapshot: paused });
    expect(last().sent).toEqual([{ type: 'takeBotSeat', seat: 2 }]);
    // a intenção fica até o servidor mostrar o resultado: se o pedido chegou tarde e foi recusado, vai de novo na pausa seguinte
    expect(table.state.wantsSeat).toBe(2);
    last().receive({ type: 'error', action: 'takeBotSeat', reason: 'midHand' });
    last().receive({ type: 'snapshot', snapshot });
    expect(last().sent).toHaveLength(1);
    last().receive({ type: 'snapshot', snapshot: paused });
    expect(last().sent).toHaveLength(2);
    // sentou: a intenção some
    const seated = structuredClone(paused);
    seated.members[4] = { ...seated.members[4], seat: 2 }; seated.members.splice(2, 1);
    last().receive({ type: 'snapshot', snapshot: seated });
    expect(table.snapshot.seat).toBe(2);
    expect(table.state.wantsSeat).toBeNull();
    expect(last().sent).toHaveLength(2);
  });

  test('entre mãos o pedido sai na hora e a intenção espera a confirmação', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const paused = playing('all').snapshot;
    paused.game!.hand!.phase = 'over';
    last().receive({ type: 'snapshot', snapshot: paused });
    table.takeBotSeat(0);
    expect(last().sent).toEqual([{ type: 'takeBotSeat', seat: 0 }]);
    expect(table.state.wantsSeat).toBe(0);
  });

  test('a intenção de sentar cai se a pessoa desistir, se a cadeira deixar de ser de um bot, no fim de jogo ou se ela já sentou', () => {
    const { table, last } = setup();
    table.connect(); last().open();
    const { snapshot } = playing('all');
    last().receive({ type: 'snapshot', snapshot });
    table.takeBotSeat(2);
    table.takeBotSeat(null);
    expect(table.state.wantsSeat).toBeNull();
    table.takeBotSeat(2);
    const taken = structuredClone(snapshot);
    taken.members[2] = { ...taken.members[2], bot: false }; // outra pessoa sentou ali
    last().receive({ type: 'snapshot', snapshot: taken });
    expect(table.state.wantsSeat).toBeNull();
    table.takeBotSeat(0);
    const over = structuredClone(snapshot);
    over.game!.over = true; over.game!.winner = 0; over.game!.hand!.phase = 'over';
    last().receive({ type: 'snapshot', snapshot: over }); // fim de jogo: não há mão seguinte para sentar
    expect(table.state.wantsSeat).toBeNull();
    last().receive({ type: 'snapshot', snapshot });
    table.takeBotSeat(0);
    const seated = structuredClone(snapshot);
    seated.members[4] = { ...seated.members[4], seat: 3 }; seated.members.splice(3, 1);
    last().receive({ type: 'snapshot', snapshot: seated });
    expect(table.state.wantsSeat).toBeNull();
    expect(last().sent).toEqual([]);
    // quem senta não pede cadeira de bot
    table.takeBotSeat(0);
    expect(table.state.wantsSeat).toBeNull();
  });
});
