import { describe, expect, test } from 'bun:test';
import { CLOSE_ROOM_ENDED, CLOSE_ROOM_NOT_FOUND, PING_INTERVAL, type RoomSnapshot } from '@truco/protocol';
import { BACKOFF_MAX, RemoteTable, type RemoteState, type SocketLike } from '../src/lib/table/remote';
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

const snapshot = (members: RoomSnapshot['members'], you: string | null): RoomSnapshot => ({ code: 'ABCD', members, you });

function setup() {
  const clock = new ManualClock();
  const sockets: FakeSocket[] = [];
  const states: RemoteState[] = [];
  const table = new RemoteTable({ url: 'ws://x/ws', room: 'abcd', token: 'tok-1' }, { socket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s; }, clock });
  table.subscribe((s) => states.push(s));
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
    last().receive({ type: 'snapshot', snapshot: snapshot([{ id: 'm1', nickname: 'Zé', connected: true }], null) });
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
    last().receive({ type: 'snapshot', snapshot: snapshot([{ id: 'm1', nickname: 'Zé', connected: true }], 'm1') });
    last().serverClose(1006);
    clock.step(); last().open();
    last().receive({ type: 'snapshot', snapshot: snapshot([], null) });
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
