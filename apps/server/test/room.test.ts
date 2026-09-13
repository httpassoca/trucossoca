import { describe, expect, test } from 'bun:test';
import type { RoomSnapshot, ServerMessage } from '@truco/protocol';
import { createRoom, DISCONNECT_GRACE, ROOM_TTL, step, type RoomEvent, type RoomInput, type RoomState } from '../src/room';

const T0 = 1_000_000;

/** Enfileira entradas numa sala e guarda tudo o que saiu, para asserções no que a sala manda e no que ela vira. */
class Sim {
  state: RoomState;
  out: { to: string; message: ServerMessage }[] = [];
  events: RoomEvent[] = [];
  constructor(public now = T0) { this.state = createRoom('ABCD', now); }
  feed(input: RoomInput, at = this.now) {
    this.now = at;
    const r = step(this.state, input, at);
    this.state = r.state; this.out.push(...r.out); this.events.push(...r.events);
    return r;
  }
  connect(token: string, at?: number) { return this.feed({ kind: 'connect', token }, at); }
  disconnect(token: string, at?: number) { return this.feed({ kind: 'disconnect', token }, at); }
  join(token: string, nickname: string, at?: number) { return this.feed({ kind: 'message', token, message: { type: 'join', nickname } }, at); }
  /** dispara o primeiro timer pendente do tipo, como o adaptador faria quando ele vence */
  fire(kind: 'death' | 'drop') {
    const t = this.state.timers.find((x) => x.kind === kind)!;
    return this.feed({ kind: 'timer', timer: t }, t.at);
  }
  /** último snapshot entregue a este token */
  snapshotFor(token: string): RoomSnapshot | undefined {
    for (let i = this.out.length - 1; i >= 0; i--) {
      const o = this.out[i];
      if (o.to === token && o.message.type === 'snapshot') return o.message.snapshot;
    }
  }
  names(token: string) { return this.snapshotFor(token)?.members.map((m) => m.nickname); }
}

describe('sala: entrar', () => {
  test('quem conecta sem entrar recebe o snapshot da sala como visitante', () => {
    const s = new Sim();
    s.connect('t1');
    const snap = s.snapshotFor('t1')!;
    expect(snap.code).toBe('ABCD');
    expect(snap.you).toBeNull();
    expect(snap.members).toEqual([]);
  });

  test('entrar com apelido cria o membro e todo mundo recebe a lista nova', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', '  Zé  ');
    s.connect('t2');
    s.join('t2', 'Dita');
    expect(s.names('t1')).toEqual(['Zé', 'Dita']);
    expect(s.names('t2')).toEqual(['Zé', 'Dita']);
    const mine = s.snapshotFor('t2')!;
    expect(mine.you).toBe(mine.members[1].id);
    expect(s.events).toContainEqual({ type: 'joined', id: mine.members[0].id, nickname: 'Zé' });
  });

  test('apelido repetido ganha sufixo em vez de ser recusado', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.connect('t2'); s.join('t2', 'zé');
    s.connect('t3'); s.join('t3', 'Zé');
    expect(s.names('t3')).toEqual(['Zé', 'zé 2', 'Zé 3']);
  });

  test('apelido vazio ou comprido demais vira algo apresentável', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', '   ');
    s.connect('t2'); s.join('t2', 'a'.repeat(80));
    const names = s.names('t2')!;
    expect(names[0].length).toBeGreaterThan(0);
    expect(names[1]).toBe('a'.repeat(20));
  });

  test('trocar de apelido passa pelo mesmo sufixo', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.connect('t2'); s.join('t2', 'Dita');
    s.feed({ kind: 'message', token: 't2', message: { type: 'nickname', nickname: 'Zé' } });
    expect(s.names('t1')).toEqual(['Zé', 'Zé 2']);
  });

  test('entrar sem ter conectado, ou trocar apelido sem ser membro, não muda nada', () => {
    const s = new Sim();
    const before = structuredClone(s.state);
    s.join('desconhecido', 'Zé');
    s.feed({ kind: 'message', token: 'desconhecido', message: { type: 'nickname', nickname: 'Zé' } });
    expect(s.state).toEqual(before);
    expect(s.out).toEqual([]);
  });

  test('o snapshot nunca carrega o token de ninguém', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    expect(JSON.stringify(s.snapshotFor('t1'))).not.toContain('t1');
  });
});

describe('sala: conexão', () => {
  test('desconectar marca o membro e atualiza a lista dos outros', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.connect('t2'); s.join('t2', 'Dita');
    s.disconnect('t2');
    const snap = s.snapshotFor('t1')!;
    expect(snap.members.map((m) => [m.nickname, m.connected])).toEqual([['Zé', true], ['Dita', false]]);
    expect(s.state.timers).toContainEqual({ kind: 'drop', token: 't2', at: T0 + DISCONNECT_GRACE });
  });

  test('reconectar com o mesmo token restaura o membro e cancela a saída', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.connect('t2'); s.join('t2', 'Dita');
    s.disconnect('t2');
    s.connect('t2', T0 + 5_000);
    expect(s.state.timers.filter((t) => t.kind === 'drop')).toEqual([]);
    const snap = s.snapshotFor('t2')!;
    expect(snap.you).toBe(snap.members[1].id);
    expect(snap.members.map((m) => [m.nickname, m.connected])).toEqual([['Zé', true], ['Dita', true]]);
    expect(s.names('t1')).toEqual(['Zé', 'Dita']);
  });

  test('sem reconectar dentro da tolerância, o membro sai da sala', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.connect('t2'); s.join('t2', 'Dita');
    s.disconnect('t2');
    s.fire('drop');
    expect(s.names('t1')).toEqual(['Zé']);
    expect(s.events).toContainEqual({ type: 'left', id: 'm2', nickname: 'Dita' });
    expect(s.state.timers.filter((t) => t.kind === 'drop')).toEqual([]);
  });

  test('um timer que já não está pendente é ignorado', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.disconnect('t1');
    const stale = s.state.timers.find((t) => t.kind === 'drop')!;
    s.connect('t1');
    const before = structuredClone(s.state);
    s.feed({ kind: 'timer', timer: stale }, stale.at);
    expect(s.state).toEqual(before);
  });

  test('visitante que desconecta some sem deixar rastro', () => {
    const s = new Sim();
    s.connect('t1');
    s.disconnect('t1');
    expect(s.state.visitors).toEqual([]);
    expect(s.state.timers.filter((t) => t.kind === 'drop')).toEqual([]);
  });

  test('ping responde pong só para quem pediu', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.out = [];
    s.feed({ kind: 'message', token: 't1', message: { type: 'ping' } });
    expect(s.out).toEqual([{ to: 't1', message: { type: 'pong' } }]);
  });
});

describe('sala: morte', () => {
  test('nasce com o timer de morte marcado para dez minutos', () => {
    const s = new Sim();
    expect(s.state.timers).toEqual([{ kind: 'death', at: T0 + ROOM_TTL }]);
  });

  test('ações na sala adiam a morte; ping não', () => {
    const s = new Sim();
    s.connect('t1', T0 + 60_000);
    s.join('t1', 'Zé', T0 + 60_000);
    expect(s.state.timers.filter((t) => t.kind === 'death')).toEqual([{ kind: 'death', at: T0 + 60_000 + ROOM_TTL }]);
    s.feed({ kind: 'message', token: 't1', message: { type: 'ping' } }, T0 + 120_000);
    s.connect('t2', T0 + 130_000);
    expect(s.state.timers.filter((t) => t.kind === 'death')).toEqual([{ kind: 'death', at: T0 + 60_000 + ROOM_TTL }]);
  });

  test('a sala morre dez minutos depois da última ação e não aceita mais nada', () => {
    const s = new Sim();
    s.connect('t1'); s.join('t1', 'Zé');
    s.fire('death');
    expect(s.state.phase).toBe('dead');
    expect(s.state.timers).toEqual([]);
    expect(s.events).toContainEqual({ type: 'died' });
    const before = structuredClone(s.state);
    s.connect('t2'); s.join('t2', 'Dita');
    expect(s.state).toEqual(before);
  });

  test('step não mexe no estado que recebeu', () => {
    const s = new Sim();
    const before = structuredClone(s.state);
    step(s.state, { kind: 'connect', token: 't1' }, T0);
    expect(s.state).toEqual(before);
  });
});
