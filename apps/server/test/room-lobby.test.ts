import { describe, expect, test } from 'bun:test';
import type { ClientMessage, RoomSnapshot, ServerMessage } from '@truco/protocol';
import { defaultRules, type Rules, type Team } from '@truco/rules';
import { createRoom, step, type RoomEvent, type RoomInput, type RoomState } from '../src/room';

const T0 = 1_000_000;
const fixedRng = () => 0.5;

/** Mesma simulação do room.test, com as ações do lobby. */
class Sim {
  state: RoomState;
  out: { to: string; message: ServerMessage }[] = [];
  events: RoomEvent[] = [];
  constructor(public now = T0) { this.state = createRoom('ABCD', now); }
  feed(input: RoomInput, at = this.now) {
    this.now = at;
    const r = step(this.state, input, at, fixedRng);
    this.state = r.state; this.out.push(...r.out); this.events.push(...r.events);
    return r;
  }
  connect(token: string) { return this.feed({ kind: 'connect', token }); }
  join(token: string, nickname: string) { this.connect(token); return this.feed({ kind: 'message', token, message: { type: 'join', nickname } }); }
  say(token: string, message: ClientMessage) { return this.feed({ kind: 'message', token, message }); }
  sit(token: string, team: Team) { return this.say(token, { type: 'takeSeat', team }); }
  stand(token: string) { return this.say(token, { type: 'leaveSeat' }); }
  start(token: string) { return this.say(token, { type: 'start' }); }
  snapshotFor(token: string): RoomSnapshot | undefined {
    for (let i = this.out.length - 1; i >= 0; i--) {
      const o = this.out[i];
      if (o.to === token && o.message.type === 'snapshot') return o.message.snapshot;
    }
  }
  /** [apelido, cadeira] de cada membro, como este token vê */
  seats(token: string) { return this.snapshotFor(token)?.members.map((m) => [m.nickname, m.seat]); }
  /** o estado como quem sabe de tudo: aqui e só aqui o teste olha o jogo inteiro */
  get game() { return this.state.game!; }
}

/** Sala com duas pessoas sentadas em duplas diferentes e um fantasma. */
function tableOfThree() {
  const s = new Sim();
  s.join('t1', 'Zé'); s.sit('t1', 0);
  s.join('t2', 'Dita'); s.sit('t2', 1);
  s.join('t3', 'Nena');
  return s;
}

describe('lobby: cadeiras e duplas', () => {
  test('sentar numa dupla ocupa a primeira cadeira livre dela: dupla 0 nas cadeiras 0 e 2, dupla 1 nas 1 e 3', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.join('t2', 'Dita'); s.sit('t2', 0);
    s.join('t3', 'Nena'); s.sit('t3', 1);
    expect(s.seats('t3')).toEqual([['Zé', 0], ['Dita', 2], ['Nena', 1]]);
    expect(s.events).toContainEqual({ type: 'seated', id: 'm1', nickname: 'Zé', seat: 0 });
  });

  test('trocar de dupla libera a cadeira antiga; sentar de novo na mesma dupla não muda nada', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.join('t2', 'Dita'); s.sit('t2', 0);
    s.sit('t1', 1);
    expect(s.seats('t2')).toEqual([['Zé', 1], ['Dita', 2]]);
    s.join('t3', 'Nena'); s.sit('t3', 0);
    expect(s.seats('t3')).toEqual([['Zé', 1], ['Dita', 2], ['Nena', 0]]);
    const before = structuredClone(s.state);
    s.sit('t3', 0);
    expect(s.state).toEqual(before);
  });

  test('a terceira pessoa numa dupla é recusada e fica sem cadeira', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.join('t2', 'Dita'); s.sit('t2', 0);
    s.join('t3', 'Nena');
    const before = structuredClone(s.state);
    s.sit('t3', 0);
    expect(s.state).toEqual(before);
    expect(s.seats('t3')).toEqual([['Zé', 0], ['Dita', 2], ['Nena', null]]);
  });

  test('levantar deixa a pessoa na sala sem cadeira', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.stand('t1');
    expect(s.seats('t1')).toEqual([['Zé', null]]);
    expect(s.events).toContainEqual({ type: 'unseated', id: 'm1', nickname: 'Zé' });
  });

  test('quem cai e não volta libera a cadeira', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.join('t2', 'Dita'); s.sit('t2', 0);
    s.feed({ kind: 'disconnect', token: 't1' });
    const drop = s.state.timers.find((t) => t.kind === 'drop')!;
    s.feed({ kind: 'timer', timer: drop }, drop.at);
    s.join('t3', 'Nena'); s.sit('t3', 0);
    expect(s.seats('t3')).toEqual([['Dita', 2], ['Nena', 0]]);
  });

  test('visitante sem apelido não senta', () => {
    const s = new Sim();
    s.connect('t1');
    const before = structuredClone(s.state);
    s.sit('t1', 0);
    expect(s.state).toEqual(before);
  });
});

describe('lobby: nomes das duplas, regras e fantasmas', () => {
  test('a sala nasce com Nós × Eles, as regras do Mineiro e fantasmas vendo as cartas', () => {
    const s = new Sim();
    s.join('t1', 'Zé');
    const snap = s.snapshotFor('t1')!;
    expect(snap.phase).toBe('lobby');
    expect(snap.teams).toEqual(['Nós', 'Eles']);
    expect(snap.rules).toEqual(defaultRules);
    expect(snap.ghostsSeeCards).toBe(true);
    expect(snap.game).toBeNull();
  });

  test('qualquer pessoa da sala renomeia qualquer dupla; nome vazio volta ao padrão', () => {
    const s = new Sim();
    s.join('t1', 'Zé');
    s.join('t2', 'Dita');
    s.say('t2', { type: 'renameTeam', team: 1, name: '  Os Bão  ' });
    expect(s.snapshotFor('t1')!.teams).toEqual(['Nós', 'Os Bão']);
    s.say('t1', { type: 'renameTeam', team: 1, name: '   ' });
    expect(s.snapshotFor('t2')!.teams).toEqual(['Nós', 'Eles']);
    s.say('t1', { type: 'renameTeam', team: 0, name: 'a'.repeat(50) });
    expect(s.snapshotFor('t2')!.teams[0]).toBe('a'.repeat(20));
  });

  test('regras e o toggle dos fantasmas valem para a sala inteira', () => {
    const s = new Sim();
    s.join('t1', 'Zé');
    s.join('t2', 'Dita');
    const rules: Rules = { ...defaultRules, allowCovered: false, tieLeader: 'leader' };
    s.say('t2', { type: 'rules', rules });
    s.say('t1', { type: 'ghostsSeeCards', on: false });
    const snap = s.snapshotFor('t2')!;
    expect(snap.rules).toEqual(rules);
    expect(snap.ghostsSeeCards).toBe(false);
  });
});

describe('começar a partida', () => {
  test('quem está sentado começa; as cadeiras vazias ganham bots e todo mundo recebe a mesa', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 1);
    s.join('t2', 'Dita');
    s.out = [];
    s.start('t1');
    const snap = s.snapshotFor('t2')!;
    expect(snap.phase).toBe('playing');
    expect(snap.members.map((m) => [m.nickname, m.seat, m.bot])).toEqual([['Zé', 1, false], ['Dita', null, false], ['Tião', 0, true], ['Nena', 2, true], ['Bastião', 3, true]]);
    expect(snap.game).not.toBeNull();
    expect(snap.game!.hand).not.toBeNull();
    expect(snap.game!.rules).toEqual(defaultRules);
    expect(s.events).toContainEqual({ type: 'started', humans: 1, bots: 3 });
    // os eventos da mesa chegam antes do snapshot que os causou
    const toZe = s.out.filter((o) => o.to === 't1').map((o) => o.message.type);
    expect(toZe).toEqual(['events', 'snapshot']);
    const ev = s.out.find((o) => o.to === 't1' && o.message.type === 'events')!.message as { events: { type: string }[] };
    expect(ev.events.map((e) => e.type)).toEqual(['newHand']);
  });

  test('os bots não repetem apelido de quem está na sala', () => {
    const s = new Sim();
    s.join('t1', 'tião'); s.sit('t1', 0);
    s.start('t1');
    expect(s.snapshotFor('t1')!.members.map((m) => m.nickname)).toEqual(['tião', 'Nena', 'Bastião', 'Cida']);
  });

  test('a partida começa com as regras que a sala escolheu', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.say('t1', { type: 'rules', rules: { ...defaultRules, allowCovered: false } });
    s.start('t1');
    expect(s.snapshotFor('t1')!.game!.rules.allowCovered).toBe(false);
  });

  test('sem ninguém sentado ninguém começa: fantasma e visitante são ignorados', () => {
    const s = new Sim();
    s.join('t1', 'Zé');
    s.connect('t2');
    const before = structuredClone(s.state);
    s.start('t1'); s.start('t2');
    expect(s.state).toEqual(before);
  });

  test('uma dupla com mais de duas pessoas não começa', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.join('t2', 'Dita'); s.sit('t2', 0);
    s.join('t3', 'Nena');
    // só por fora da porta se chega aqui; a sala precisa segurar mesmo assim
    s.state.members.find((m) => m.token === 't3')!.seat = 0;
    const before = structuredClone(s.state);
    s.start('t1');
    expect(s.state).toEqual(before);
  });

  test('depois de começar, duplas, nomes, regras e um segundo começar são recusados', () => {
    const s = tableOfThree();
    s.start('t1');
    const before = structuredClone(s.state);
    s.sit('t3', 0); s.sit('t1', 1); s.stand('t1');
    s.say('t3', { type: 'renameTeam', team: 0, name: 'Tarde' });
    s.say('t2', { type: 'rules', rules: { ...defaultRules, target: 3 } });
    s.start('t2');
    expect(s.state).toEqual(before);
    expect(s.snapshotFor('t3')!.teams).toEqual(['Nós', 'Eles']);
  });

  test('começar também adia a morte da sala', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.start('t1');
    s.now = T0 + 60_000;
    expect(s.state.timers.filter((t) => t.kind === 'death')).toEqual([{ kind: 'death', at: T0 + 10 * 60_000 }]);
  });
});

describe('visibilidade das cartas', () => {
  test('quem está sentado vê só as próprias cartas e nem os ids do monte', () => {
    const s = tableOfThree();
    s.start('t1');
    const real = s.game.hand!;
    const mine = s.snapshotFor('t1')!.game!.hand!;
    expect(mine.cards[0]).toEqual(real.cards[0]);
    expect(mine.cards[1]).toEqual([null, null, null]);
    expect(mine.cards[2]).toEqual([null, null, null]);
    expect(mine.cards[3]).toEqual([null, null, null]);
    expect(mine.stock).toBe(28);
    const wire = JSON.stringify(s.snapshotFor('t1'));
    for (const id of [...real.cards[1], ...real.cards[2], ...real.cards[3], ...real.stock]) expect(wire).not.toContain(`"${id}"`);
    const dita = s.snapshotFor('t2')!.game!.hand!;
    expect(dita.cards[1]).toEqual(real.cards[1]);
    expect(dita.cards[0]).toEqual([null, null, null]);
  });

  test('fantasma vê todas as cartas com o toggle ligado e nenhuma com ele desligado; o monte nunca', () => {
    const s = tableOfThree();
    s.start('t1');
    const real = s.game.hand!;
    const ghost = s.snapshotFor('t3')!.game!.hand!;
    expect(ghost.cards).toEqual(real.cards);
    expect(ghost.stock).toBe(28);
    s.say('t2', { type: 'ghostsSeeCards', on: false });
    const blind = s.snapshotFor('t3')!.game!.hand!;
    expect(blind.cards).toEqual([[null, null, null], [null, null, null], [null, null, null], [null, null, null]]);
    // quem está sentado continua vendo as suas
    expect(s.snapshotFor('t1')!.game!.hand!.cards[0]).toEqual(real.cards[0]);
  });

  test('quem chega no meio da partida vê a mesa como fantasma; antes de entrar com apelido, não vê carta nenhuma', () => {
    const s = tableOfThree();
    s.start('t1');
    s.connect('t4');
    const visitor = s.snapshotFor('t4')!;
    expect(visitor.phase).toBe('playing');
    expect(visitor.game!.hand!.cards.flat().every((c) => c === null)).toBe(true);
    s.feed({ kind: 'message', token: 't4', message: { type: 'join', nickname: 'Bastião' } });
    const late = s.snapshotFor('t4')!;
    expect(late.phase).toBe('playing');
    expect(late.members.find((m) => m.id === late.you)!.seat).toBeNull();
    expect(late.game!.hand!.cards).toEqual(s.game.hand!.cards);
  });
});
