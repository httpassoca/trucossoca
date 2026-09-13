import { describe, expect, test } from 'bun:test';
import { IDLE_HANDOFF, type ClientMessage, type RoomSnapshot, type ServerMessage } from '@truco/protocol';
import { canRaise, defaultRules, teamOf, type CardId, type GameEvent, type PlayView, type Seat, type Team } from '@truco/rules';
import { BOT_DECISION_EXTRA, createRoom, DEFAULT_PACE, DISCONNECT_GRACE, step, type RoomEvent, type RoomInput, type RoomState, type RoomTimer } from '../src/room';

const T0 = 1_000_000;
/** Com 0.5 os bots são previsíveis: nunca trucam nem cobrem; aceitam com A ou melhor; jogam a mão de dez com 2 ou melhor. */
const fixedRng = () => 0.5;

/** baralho onde os últimos 12 são as cartas de cada cadeira (deal faz pop): seat s recebe deck[-1-s], deck[-5-s], deck[-9-s] */
function deckFor(cards: CardId[][]): CardId[] {
  const dealt: CardId[] = [];
  for (let i = 0; i < 3; i++) for (let s = 0; s < 4; s++) dealt.push(cards[s][i]);
  return [...dealt].reverse();
}

/** A sala com as entradas enfileiradas, os baralhos de cada mão fixados e tudo o que saiu guardado por destinatário. */
class Sim {
  state: RoomState;
  out: { to: string; message: ServerMessage }[] = [];
  events: RoomEvent[] = [];
  decks: Record<number, CardId[][]> = {};
  constructor(public now = T0) { this.state = createRoom('ABCD', now); }
  feed(input: RoomInput, at = this.now) {
    this.now = at;
    const r = step(this.state, input, at, { rng: fixedRng, deck: (n) => (this.decks[n] ? deckFor(this.decks[n]) : undefined) });
    this.state = r.state; this.out.push(...r.out); this.events.push(...r.events);
    return r;
  }
  connect(token: string) { return this.feed({ kind: 'connect', token }); }
  join(token: string, nickname: string) { this.connect(token); return this.feed({ kind: 'message', token, message: { type: 'join', nickname } }); }
  say(token: string, message: ClientMessage) { return this.feed({ kind: 'message', token, message }); }
  sit(token: string, team: Team) { return this.say(token, { type: 'takeSeat', team }); }
  start(token: string) { return this.say(token, { type: 'start' }); }
  fire(timer: RoomTimer) { return this.feed({ kind: 'timer', timer }, timer.at); }
  /** o próximo timer da mesa (bot ou mão nova) */
  gameTimer() { return this.state.timers.find((t) => t.kind === 'bot' || t.kind === 'nextHand'); }
  snapshotFor(token: string): RoomSnapshot | undefined {
    for (let i = this.out.length - 1; i >= 0; i--) {
      const o = this.out[i];
      if (o.to === token && o.message.type === 'snapshot') return o.message.snapshot;
    }
  }
  snapshotsFor(token: string): RoomSnapshot[] { return this.out.filter((o) => o.to === token && o.message.type === 'snapshot').map((o) => (o.message as { snapshot: RoomSnapshot }).snapshot); }
  eventsFor(token: string): GameEvent[] { return this.out.filter((o) => o.to === token && o.message.type === 'events').flatMap((o) => (o.message as { events: GameEvent[] }).events); }
  errorsFor(token: string) { return this.out.filter((o) => o.to === token && o.message.type === 'error').map((o) => o.message as { type: 'error'; action: string; reason: string }); }
  /** o estado como quem sabe de tudo: aqui e só aqui o teste olha o jogo inteiro */
  get game() { return this.state.game!; }
}

/** Zé (t1) na cadeira 0 e Dita (t2) na 2 — a dupla Nós; Nena (t3) assiste. As cadeiras 1 e 3 ganham bots ao começar. */
function nosContraBots() {
  const s = new Sim();
  s.join('t1', 'Zé'); s.sit('t1', 0);
  s.join('t2', 'Dita'); s.sit('t2', 0);
  s.join('t3', 'Nena');
  return s;
}
const HUMANS: [string, Seat][] = [['t1', 0], ['t2', 2]];

/**
 * Cinco mãos roteirizadas, cada uma com o seu baralho. Com os bots previsíveis e as pessoas jogando sempre a carta
 * mais forte, o placar é conhecido de antemão: 2 (truco recusado), +4 (truco aceito e ganho), bots fazem 2,
 * +4 (truco aceito e ganho) → 10 × 2 → mão de dez jogada e ganha → 14 × 2.
 */
const SCRIPT: Record<number, { cards: CardId[][]; raiser?: Seat }> = {
  1: { cards: [['4c', '7h', 'As'], ['4d', '5d', '6d'], ['7d', '3c', '2c'], ['4h', '5h', '6h']], raiser: 0 },
  2: { cards: [['7h', '2c', '5s'], ['4d', '5d', '6d'], ['4c', 'As', '2d'], ['3c', '4h', '5h']], raiser: 2 },
  3: { cards: [['4d', '5d', '6d'], ['4c', '7h', 'As'], ['4h', '5h', '6h'], ['7d', '3c', '2c']] },
  4: { cards: [['4c', '7h', '5s'], ['3d', '4d', '5d'], ['As', '7d', '6s'], ['4h', '5h', '6h']], raiser: 0 },
  5: { cards: [['4c', 'As', '5s'], ['4d', '5d', '6d'], ['7h', '7d', '6s'], ['4h', '5h', '6h']] },
};

const strengthOrder: CardId[] = ['4c', '7h', 'As', '7d', '3c', '3d', '3h', '3s', '2c', '2d', '2h', '2s', 'Ac', 'Ad', 'Ah'];
const strongest = (held: (CardId | null)[]) => [...held].filter((c): c is CardId => c !== null).sort((a, b) => (strengthOrder.indexOf(a) + 1 || 99) - (strengthOrder.indexOf(b) + 1 || 99))[0];

/** Uma pessoa agindo pelo que o seu último snapshot mostra, como o cliente faria. Devolve se agiu. */
function humanAct(s: Sim, token: string, seat: Seat, raised: Set<string>): boolean {
  const g = s.snapshotFor(token)?.game; const h = g?.hand;
  if (!g || !h || g.over || h.phase === 'over') return false;
  const team = teamOf(seat), firstOfTeam = team === 0 ? 0 : 1;
  if (h.phase === 'dezDecision') { if (h.decider !== team || seat !== firstOfTeam) return false; s.say(token, { type: 'decideDez', action: 'play' }); return true; }
  if (h.phase === 'respond') { if (teamOf(h.pending!.by) === team || seat !== firstOfTeam) return false; s.say(token, { type: 'respond', action: 'accept' }); return true; }
  if (h.turn !== seat) return false;
  const key = `${g.handNo}:${seat}`;
  if (SCRIPT[g.handNo]?.raiser === seat && !raised.has(key) && canRaise(g, seat)) { raised.add(key); s.say(token, { type: 'raise' }); return true; }
  s.say(token, { type: 'play', id: strongest(h.cards[seat]), covered: false });
  return true;
}

/** Roda a partida: pessoas agem no que veem, timers da mesa vencem em ordem, até `until` (ou o fim de jogo). */
function run(s: Sim, until: (s: Sim) => boolean = (x) => !!x.state.game?.over, humans = HUMANS) {
  const raised = new Set<string>();
  for (let guard = 0; guard < 400; guard++) {
    if (until(s)) return;
    if (humans.some(([token, seat]) => humanAct(s, token, seat, raised))) continue;
    const t = s.gameTimer(); if (!t) throw new Error(`a mesa parou: ${JSON.stringify(s.game.hand?.phase)}`);
    s.fire(t);
  }
  throw new Error('a partida não acabou');
}

function scripted() {
  const s = nosContraBots();
  for (const [n, { cards }] of Object.entries(SCRIPT)) s.decks[Number(n)] = cards;
  s.start('t1');
  return s;
}

describe('partida online: uma partida inteira roteirizada', () => {
  test('cinco mãos com baralho fixo chegam ao fim de jogo com o placar esperado', () => {
    const s = scripted();
    run(s);
    const g = s.game;
    expect(g.over).toBe(true);
    expect(g.winner).toBe(0);
    expect(g.scores).toEqual([14, 2]);
    expect(g.handNo).toBe(5);
    const ends = s.eventsFor('t1').filter((e): e is GameEvent & { type: 'handEnd' } => e.type === 'handEnd');
    expect(ends.map((e) => [e.winner, e.points])).toEqual([[0, 2], [0, 4], [1, 2], [0, 4], [0, 4]]);
    expect(s.eventsFor('t1').filter((e) => e.type === 'gameOver')).toEqual([{ type: 'gameOver', winner: 0 }]);
    expect(s.events).toContainEqual({ type: 'gameOver', winner: 0, scores: '14x2' });
    // ninguém foi recusado, e depois do fim ninguém tem de agir nem há timer da mesa
    for (const t of ['t1', 't2', 't3']) expect(s.errorsFor(t)).toEqual([]);
    expect(s.gameTimer()).toBeUndefined();
    expect(s.snapshotFor('t3')!.game!.over).toBe(true);
  });

  test('cada pessoa recebe o mesmo lote de eventos, na mesma ordem, e a mesma semente de cada jogada', () => {
    const s = scripted();
    run(s);
    const a = s.eventsFor('t1'), b = s.eventsFor('t2'), c = s.eventsFor('t3');
    expect(a.length).toBeGreaterThan(40);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    for (const e of a) if (e.type === 'play') expect(Number.isInteger(e.seed)).toBe(true);
    // os eventos de uma jogada chegam antes do snapshot que a mostra
    const toZe = s.out.filter((o) => o.to === 't1').map((o) => o.message.type);
    for (let i = 0; i < toZe.length; i++) if (toZe[i] === 'events') expect(toZe[i + 1]).toBe('snapshot');
  });

  test('em nenhum snapshot uma cadeira recebe as cartas de outra, fora as do parceiro na decisão da mão de dez', () => {
    const s = scripted();
    run(s);
    for (const [token, seat] of HUMANS) {
      const snaps = s.snapshotsFor(token).filter((x) => x.game?.hand);
      expect(snaps.length).toBeGreaterThan(20);
      for (const snap of snaps) {
        const h = snap.game!.hand!;
        for (const other of [0, 1, 2, 3] as Seat[]) {
          if (other === seat) continue;
          const peek = h.phase === 'dezDecision' && h.revealPartner && h.decider === teamOf(seat) && other === (seat + 2) % 4;
          if (!peek) expect(h.cards[other].every((c) => c === null)).toBe(true);
        }
        expect(typeof h.stock).toBe('number');
      }
    }
  });
});

describe('partida online: jogadas recusadas', () => {
  test('no lobby, qualquer jogada é recusada e nada muda', () => {
    const s = nosContraBots();
    const before = structuredClone(s.state);
    s.out = [];
    s.say('t1', { type: 'play', id: '4c', covered: false });
    s.say('t1', { type: 'raise' });
    s.say('t1', { type: 'rematch' });
    expect(s.state).toEqual(before);
    expect(s.out).toEqual([
      { to: 't1', message: { type: 'error', action: 'play', reason: 'notPlaying' } },
      { to: 't1', message: { type: 'error', action: 'raise', reason: 'notPlaying' } },
      { to: 't1', message: { type: 'error', action: 'rematch', reason: 'notPlaying' } },
    ]);
  });

  test('fantasma e visitante não jogam', () => {
    const s = scripted();
    s.connect('t4');
    const before = structuredClone(s.state);
    s.out = [];
    s.say('t3', { type: 'raise' });
    s.say('t4', { type: 'play', id: '4c', covered: false });
    expect(s.state).toEqual(before);
    expect(s.out).toEqual([{ to: 't3', message: { type: 'error', action: 'raise', reason: 'notSeated' } }]);
  });

  test('fora da vez, carta que não tem, resposta sem pedido, mão de dez fora dela e revanche antes do fim: o motor recusa', () => {
    const s = scripted(); // mão 1: vez da cadeira 0 (Zé)
    const before = structuredClone(s.state);
    s.out = [];
    s.say('t2', { type: 'play', id: '7d', covered: false });   // Dita, fora da vez
    s.say('t1', { type: 'play', id: '2c', covered: false });   // Zé não tem o 2♣
    s.say('t1', { type: 'respond', action: 'accept' });        // ninguém pediu truco
    s.say('t1', { type: 'decideDez', action: 'run' });          // não é mão de dez
    s.say('t2', { type: 'rematch' });                           // a partida está em curso
    expect(s.state).toEqual(before);
    expect(s.out.map((o) => [o.to, (o.message as { action: string }).action, (o.message as { reason: string }).reason])).toEqual([
      ['t2', 'play', 'illegal'], ['t1', 'play', 'illegal'], ['t1', 'respond', 'illegal'], ['t1', 'decideDez', 'illegal'], ['t2', 'rematch', 'illegal'],
    ]);
    // só quem errou recebe o erro
    expect(s.out.every((o) => o.message.type === 'error')).toBe(true);
  });

  test('uma jogada recusada não adia a morte da sala; uma aceita adia', () => {
    const s = scripted();
    const death = s.state.timers.find((t) => t.kind === 'death')!;
    s.feed({ kind: 'message', token: 't2', message: { type: 'raise' } }, T0 + 30_000);
    expect(s.state.timers.find((t) => t.kind === 'death')).toEqual(death);
    s.feed({ kind: 'message', token: 't1', message: { type: 'raise' } }, T0 + 30_000);
    expect(s.state.timers.find((t) => t.kind === 'death')!.at).toBe(death.at + 30_000);
  });
});

describe('partida online: bots no servidor', () => {
  test('quando a vez é de um bot, a sala pede um timer com o ritmo configurado; ao vencer, o bot joga', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 1); // o mão da 1ª mão é a cadeira 0: um bot
    s.start('t1');
    expect(s.gameTimer()).toEqual({ kind: 'bot', seat: 0, at: T0 + DEFAULT_PACE.botDelay });
    s.out = [];
    s.fire(s.gameTimer()!);
    const ev = s.eventsFor('t1');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'play', seat: 0 });
    expect(s.snapshotFor('t1')!.game!.hand!.turn).toBe(1);
    // agora é a vez da pessoa: nenhum timer da mesa
    expect(s.gameTimer()).toBeUndefined();
  });

  test('o ritmo é configurável por sala e a resposta ao truco demora um pouco mais', () => {
    const s = new Sim();
    s.state = createRoom('ABCD', T0, { botDelay: 100, handPause: 50 });
    s.join('t1', 'Zé'); s.sit('t1', 0);
    s.decks[1] = SCRIPT[1].cards;
    s.start('t1');
    s.say('t1', { type: 'raise' });
    expect(s.gameTimer()).toEqual({ kind: 'bot', seat: 1, at: T0 + 100 + BOT_DECISION_EXTRA });
    s.fire(s.gameTimer()!);
    expect(s.eventsFor('t1').filter((e) => e.type === 'respond')).toEqual([{ type: 'respond', seat: 1, action: 'decline', value: 2, winnerTeam: 0 }]);
    // a mão acabou: a próxima espera a pausa
    expect(s.gameTimer()).toEqual({ kind: 'nextHand', at: T0 + 100 + BOT_DECISION_EXTRA + 50 });
    s.fire(s.gameTimer()!);
    expect(s.snapshotFor('t1')!.game!.handNo).toBe(2);
    expect(s.eventsFor('t1').filter((e) => e.type === 'newHand')).toHaveLength(2);
  });

  test('um timer da mesa que já não vale (a situação mudou) é ignorado', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 1);
    s.start('t1');
    const stale = s.gameTimer()!;
    s.fire(stale); // o bot da cadeira 0 jogou; a vez é da pessoa
    const before = structuredClone(s.state);
    s.fire(stale);
    expect(s.state).toEqual(before);
    // o bot não joga pela pessoa nem quando alguém empurra um timer inventado
    s.feed({ kind: 'timer', timer: { kind: 'bot', seat: 1, at: s.now } });
    expect(s.state).toEqual(before);
  });

  test('truco e mão de dez são da dupla: com uma pessoa na dupla, o bot parceiro espera por ela', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 1); // Zé na cadeira 1; bot parceiro na 3, bots na 0 e 2
    s.decks[1] = [['4c', '5d', '6d'], ['4d', '5h', '6h'], ['7h', '5s', '6s'], ['4h', '5c', '6c']];
    s.start('t1');
    s.fire(s.gameTimer()!); // bot 0 abre a mão
    s.say('t1', { type: 'raise' }); // Zé truca: quem responde é a cadeira 2, um bot numa dupla só de bots
    expect(s.gameTimer()).toMatchObject({ kind: 'bot', seat: 2 });
    s.fire(s.gameTimer()!);
    expect(s.eventsFor('t1').filter((e) => e.type === 'respond')).toEqual([{ type: 'respond', seat: 2, action: 'accept', value: 4 }]);
  });
});

describe('partida online: mão de dez', () => {
  test('na decisão, cada cadeira da dupla que decide vê as cartas do parceiro, e só enquanto decide', () => {
    const s = scripted();
    run(s, (x) => x.state.game?.hand?.phase === 'dezDecision');
    const real = s.game.hand!;
    expect(real.special).toBe('dez');
    expect(real.decider).toBe(0);
    const ze = s.snapshotFor('t1')!.game!.hand!, dita = s.snapshotFor('t2')!.game!.hand!;
    expect(ze.cards[0]).toEqual(real.cards[0]);
    expect(ze.cards[2]).toEqual(real.cards[2]);
    expect(dita.cards[0]).toEqual(real.cards[0]);
    expect(dita.cards[2]).toEqual(real.cards[2]);
    expect(ze.cards[1]).toEqual([null, null, null]);
    expect(dita.cards[3]).toEqual([null, null, null]);
    // ninguém tem de agir pelo motor, mas nenhum timer de bot é pedido: a decisão é das pessoas
    expect(s.gameTimer()).toBeUndefined();
    s.say('t1', { type: 'decideDez', action: 'play' });
    const after = s.snapshotFor('t1')!.game!.hand!;
    expect(after.phase).toBe('play');
    expect(after.cards[0]).toEqual(real.cards[0]);
    expect(after.cards[2]).toEqual([null, null, null]);
    expect(s.snapshotFor('t2')!.game!.hand!.cards[0]).toEqual([null, null, null]);
  });

  test('a dupla que não decide não vê o parceiro, e não decide; uma dupla só de bots decide pelo timer', () => {
    const s = new Sim();
    s.join('t1', 'Zé'); s.sit('t1', 1); s.join('t2', 'Dita'); s.sit('t2', 1); // Zé na 1, Dita na 3: a dupla Eles; bots na 0 e 2
    // cinco mãos em que os bots levam as manilhas e fazem 2 por mão: 10 × 0, e a sexta é a mão de dez deles
    for (let n = 1; n <= 6; n++) s.decks[n] = [['4c', '7h', 'As'], ['4d', '5d', '6d'], ['7d', '3c', '2c'], ['4h', '5h', '6h']];
    s.start('t1');
    run(s, (x) => x.state.game?.hand?.phase === 'dezDecision', [['t1', 1], ['t2', 3]]);
    const real = s.game.hand!;
    expect(s.game.scores).toEqual([10, 0]);
    expect(real.decider).toBe(0);
    const ze = s.snapshotFor('t1')!.game!.hand!;
    expect(ze.cards[1]).toEqual(real.cards[1]);
    expect(ze.cards[3]).toEqual([null, null, null]);
    s.out = [];
    s.say('t1', { type: 'decideDez', action: 'run' });
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'decideDez', reason: 'illegal' } }]);
    // a dupla de bots decide pelo timer
    expect(s.gameTimer()).toMatchObject({ kind: 'bot', seat: 0 });
    s.fire(s.gameTimer()!);
    expect(s.eventsFor('t1').filter((e) => e.type === 'dez')).toEqual([{ type: 'dez', team: 0, action: 'play' }]);
  });
});

describe('partida online: carta coberta', () => {
  test('a coberta chega sem id para todo mundo menos quem jogou; o fantasma que vê tudo vê o id', () => {
    const s = nosContraBots();
    s.decks[1] = [['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']];
    s.start('t1');
    s.say('t1', { type: 'play', id: '4c', covered: false });
    s.fire(s.gameTimer()!);
    s.say('t2', { type: 'play', id: 'Ks', covered: false });
    s.fire(s.gameTimer()!); // vaza 1 para Nós, Zé sai na 2ª
    s.out = [];
    s.say('t1', { type: 'play', id: '4d', covered: true });
    const mine = s.snapshotFor('t1')!.game!.hand!.played[1][0];
    expect(mine).toMatchObject({ seat: 0, id: '4d', covered: true, kind: 'cover' });
    expect(s.snapshotFor('t2')!.game!.hand!.played[1][0]).toEqual({ ...mine, id: null } as PlayView);
    expect(s.snapshotFor('t3')!.game!.hand!.played[1][0]).toEqual(mine);
    expect(s.eventsFor('t1')).toEqual([{ type: 'play', seat: 0, id: '4d', covered: true, kind: 'cover', seed: mine.seed }]);
    expect(s.eventsFor('t2')).toEqual([{ type: 'play', seat: 0, id: null, covered: true, kind: 'cover', seed: mine.seed }]);
    expect(s.eventsFor('t3')).toEqual(s.eventsFor('t1'));
    expect(JSON.stringify(s.out.filter((o) => o.to === 't2'))).not.toContain('4d');
  });
});

describe('partida online: revanche', () => {
  test('no fim de jogo, quem está sentado devolve a sala ao lobby com cadeiras, nomes das duplas e regras; os bots saem', () => {
    const s = nosContraBots();
    s.say('t3', { type: 'renameTeam', team: 0, name: 'Os Bão' });
    s.say('t1', { type: 'rules', rules: { ...defaultRules, tieLeader: 'leader' } });
    for (const [n, { cards }] of Object.entries(SCRIPT)) s.decks[Number(n)] = cards;
    s.start('t1');
    run(s);
    s.out = [];
    s.say('t2', { type: 'rematch' });
    const snap = s.snapshotFor('t3')!;
    expect(snap.phase).toBe('lobby');
    expect(snap.game).toBeNull();
    expect(snap.members.map((m) => [m.nickname, m.seat, m.bot])).toEqual([['Zé', 0, false], ['Dita', 2, false], ['Nena', null, false]]);
    expect(snap.teams).toEqual(['Os Bão', 'Eles']);
    expect(snap.rules.tieLeader).toBe('leader');
    expect(s.events).toContainEqual({ type: 'rematch', id: 'm2', nickname: 'Dita' });
    expect(s.gameTimer()).toBeUndefined();
    // e a partida seguinte começa do zero, com bots de novo nas cadeiras vazias
    s.start('t1');
    expect(s.snapshotFor('t1')!.game!.scores).toEqual([0, 0]);
    expect(s.snapshotFor('t1')!.members.filter((m) => m.bot).map((m) => m.seat)).toEqual([1, 3]);
  });

  test('fantasma não pede revanche; no lobby um segundo pedido é recusado', () => {
    const s = scripted();
    run(s);
    s.out = [];
    s.say('t3', { type: 'rematch' });
    expect(s.out).toEqual([{ to: 't3', message: { type: 'error', action: 'rematch', reason: 'notSeated' } }]);
    s.say('t1', { type: 'rematch' });
    s.out = [];
    s.say('t2', { type: 'rematch' });
    expect(s.out).toEqual([{ to: 't2', message: { type: 'error', action: 'rematch', reason: 'notPlaying' } }]);
  });
});

describe('partida online: ausência', () => {
  const dropOf = (s: Sim) => s.state.timers.find((t) => t.kind === 'drop')!;
  const memberNamed = (s: Sim, token: string, name: string) => s.snapshotFor(token)!.members.find((m) => m.nickname === name)!;

  test('quem cai no meio da partida segura a cadeira por vinte segundos; depois um bot joga por ela, sem tirá-la da sala', () => {
    const s = scripted(); // mão 1: vez de Zé (cadeira 0)
    s.feed({ kind: 'disconnect', token: 't1' });
    expect(s.state.timers).toContainEqual({ kind: 'drop', token: 't1', at: T0 + DISCONNECT_GRACE });
    expect(s.gameTimer()).toBeUndefined(); // enquanto Zé pode voltar, a vez segue dele
    s.fire(dropOf(s));
    expect(memberNamed(s, 't2', 'Zé')).toMatchObject({ seat: 0, connected: false, bot: false, botControlled: true });
    expect(s.events).toContainEqual({ type: 'botTakeover', id: 'm1', nickname: 'Zé', seat: 0, cause: 'dropped' });
    // a cadeira 0 agora é de um bot: a sala pede o timer da mesa e ele joga
    expect(s.gameTimer()).toEqual({ kind: 'bot', seat: 0, at: T0 + DISCONNECT_GRACE + DEFAULT_PACE.botDelay });
    s.fire(s.gameTimer()!);
    expect(s.eventsFor('t2').filter((e) => e.type === 'play')).toEqual([expect.objectContaining({ type: 'play', seat: 0 })]);
  });

  test('voltar antes dos vinte segundos cancela a tomada: a cadeira nunca foi de um bot', () => {
    const s = scripted();
    s.feed({ kind: 'disconnect', token: 't1' });
    s.feed({ kind: 'connect', token: 't1' }, T0 + 5_000);
    expect(s.state.timers.filter((t) => t.kind === 'drop')).toEqual([]);
    expect(memberNamed(s, 't1', 'Zé')).toMatchObject({ connected: true, botControlled: false });
    expect(s.events.filter((e) => e.type === 'botTakeover' || e.type === 'reclaimed')).toEqual([]);
  });

  test('voltar depois da tomada retoma a cadeira na hora, com as cartas, e o bot para de jogar por ela', () => {
    const s = scripted();
    s.feed({ kind: 'disconnect', token: 't1' });
    s.fire(dropOf(s));
    const pending = s.gameTimer()!; // o bot ia jogar pela cadeira 0
    s.out = [];
    s.feed({ kind: 'connect', token: 't1' }, s.now + 100);
    const snap = s.snapshotFor('t1')!;
    expect(snap.members[0]).toMatchObject({ nickname: 'Zé', seat: 0, connected: true, botControlled: false });
    expect([...snap.game!.hand!.cards[0]].sort()).toEqual([...SCRIPT[1].cards[0]].sort());
    expect(s.events).toContainEqual({ type: 'reclaimed', id: 'm1', nickname: 'Zé', seat: 0 });
    expect(s.gameTimer()).toBeUndefined();
    const before = structuredClone(s.state);
    s.fire(pending); // o timer velho já não vale
    expect(s.state).toEqual(before);
  });

  test('quem já tem um bot jogando por si e depois cai não é tomada duas vezes; no fim de jogo ninguém é tomado', () => {
    const s = scripted();
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + IDLE_HANDOFF);
    s.feed({ kind: 'disconnect', token: 't2' });
    s.fire(dropOf(s));
    expect(s.events.filter((e) => e.type === 'botTakeover')).toHaveLength(1);
    run(s, undefined, [['t1', 0]]);
    s.say('t2', { type: 'raise' }); // Dita retoma no fim de jogo (a jogada em si é recusada)
    s.out = [];
    s.feed({ kind: 'message', token: 't2', message: { type: 'handToBot', member: 'm1' } }, s.now + IDLE_HANDOFF);
    expect(s.out).toEqual([{ to: 't2', message: { type: 'error', action: 'handToBot', reason: 'illegal' } }]);
    s.feed({ kind: 'disconnect', token: 't1' });
    s.fire(dropOf(s));
    expect(s.events.filter((e) => e.type === 'botTakeover')).toHaveLength(1);
    expect(memberNamed(s, 't3', 'Zé')).toMatchObject({ connected: false, botControlled: false });
  });

  test('passar a cadeira de quem caiu há pouco é recusado: ela tem o próprio prazo', () => {
    const s = scripted();
    s.feed({ kind: 'disconnect', token: 't2' }, T0 + IDLE_HANDOFF);
    s.out = [];
    s.say('t1', { type: 'handToBot', member: 'm2' });
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'handToBot', reason: 'illegal' } }]);
  });

  test('uma tomada ou retomada durante a pausa entre mãos não adia a mão seguinte', () => {
    const s = new Sim();
    s.state = createRoom('ABCD', T0, { botDelay: 100, handPause: 5_000 });
    s.join('t1', 'Zé'); s.sit('t1', 0); s.join('t2', 'Dita'); s.sit('t2', 0);
    s.decks[1] = SCRIPT[1].cards;
    s.start('t1');
    s.say('t1', { type: 'raise' });
    s.fire(s.gameTimer()!); // o bot corre: mão 1 acabou, a pausa está marcada
    const pause = s.gameTimer()!;
    expect(pause.kind).toBe('nextHand');
    // Dita estava muda desde antes: a tolerância vence no meio da pausa
    s.feed({ kind: 'disconnect', token: 't2', since: pause.at - 3_000 - DISCONNECT_GRACE }, pause.at - 4_000);
    expect(dropOf(s).at).toBe(pause.at - 3_000);
    s.fire(dropOf(s));
    expect(s.state.members[1].botControlled).toBe(true);
    expect(s.gameTimer()).toEqual(pause);
    s.feed({ kind: 'connect', token: 't2' }, pause.at - 2_000);
    expect(s.state.members[1].botControlled).toBe(false);
    expect(s.gameTimer()).toEqual(pause);
  });

  test('fantasma que cai durante a partida sai da sala como sempre', () => {
    const s = scripted();
    s.feed({ kind: 'disconnect', token: 't3' });
    s.fire(dropOf(s));
    expect(s.snapshotFor('t1')!.members.map((m) => m.nickname)).toEqual(['Zé', 'Dita', 'Tião', 'Bastião']);
    expect(s.events).toContainEqual({ type: 'left', id: 'm3', nickname: 'Nena' });
  });

  test('quem está parada há um minuto pode ter a cadeira passada a um bot por outra pessoa sentada; antes disso, não', () => {
    const s = scripted(); // a partida começa em T0: os relógios de parada começam aqui
    s.out = [];
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + IDLE_HANDOFF - 1);
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'handToBot', reason: 'notIdle' } }]);
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + IDLE_HANDOFF);
    expect(memberNamed(s, 't3', 'Dita')).toMatchObject({ seat: 2, connected: true, bot: false, botControlled: true });
    expect(s.events).toContainEqual({ type: 'botTakeover', id: 'm2', nickname: 'Dita', seat: 2, cause: 'idle', by: 'm1' });
  });

  test('a pessoa parada retoma a cadeira na primeira jogada que manda, mesmo uma recusada, e volta a contar como ativa', () => {
    const s = scripted();
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + IDLE_HANDOFF);
    s.out = [];
    s.say('t2', { type: 'play', id: '4c', covered: false }); // Dita não tem o 4♣ nem a vez
    expect(s.errorsFor('t2')).toEqual([{ type: 'error', action: 'play', reason: 'illegal' }]);
    expect(memberNamed(s, 't2', 'Dita').botControlled).toBe(false);
    expect(s.events).toContainEqual({ type: 'reclaimed', id: 'm2', nickname: 'Dita', seat: 2 });
    s.out = [];
    s.say('t1', { type: 'handToBot', member: 'm2' });
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'handToBot', reason: 'notIdle' } }]);
  });

  test('enquanto é bot, a cadeira joga pelo timer; quando a pessoa retoma jogando, o timer some e a jogada vale', () => {
    const s = scripted();
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + IDLE_HANDOFF);
    s.say('t1', { type: 'play', id: '4c', covered: false });
    s.fire(s.gameTimer()!); // bot da cadeira 1
    expect(s.gameTimer()).toMatchObject({ kind: 'bot', seat: 2 });
    s.out = [];
    s.say('t2', { type: 'play', id: '2c', covered: false });
    expect(s.eventsFor('t2')).toEqual([expect.objectContaining({ type: 'play', seat: 2, id: '2c' })]);
    expect(s.gameTimer()).toMatchObject({ kind: 'bot', seat: 3 });
  });

  test('passar a cadeira: só quem senta, só durante a partida, só de outra pessoa sentada que ainda não é bot', () => {
    const s = nosContraBots();
    for (const [n, { cards }] of Object.entries(SCRIPT)) s.decks[Number(n)] = cards;
    s.out = [];
    s.say('t1', { type: 'handToBot', member: 'm2' });
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'handToBot', reason: 'notPlaying' } }]);
    s.start('t1');
    s.now = T0 + IDLE_HANDOFF;
    s.out = [];
    s.say('t3', { type: 'handToBot', member: 'm2' }); // fantasma
    s.say('t1', { type: 'handToBot', member: 'm1' }); // a própria
    s.say('t1', { type: 'handToBot', member: 'm3' }); // um fantasma
    s.say('t1', { type: 'handToBot', member: 'm4' }); // um bot
    s.say('t1', { type: 'handToBot', member: 'm99' }); // ninguém
    expect(s.out.map((o) => [o.to, (o.message as { reason: string }).reason])).toEqual([['t3', 'notSeated'], ['t1', 'illegal'], ['t1', 'illegal'], ['t1', 'illegal'], ['t1', 'illegal']]);
    s.say('t1', { type: 'handToBot', member: 'm2' });
    s.out = [];
    s.say('t1', { type: 'handToBot', member: 'm2' }); // já é bot
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'handToBot', reason: 'illegal' } }]);
  });

  test('o relógio de parada começa com a partida, não no lobby', () => {
    const s = nosContraBots(); // Dita entrou em T0
    s.feed({ kind: 'message', token: 't1', message: { type: 'start' } }, T0 + 2 * IDLE_HANDOFF);
    s.out = [];
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + 2 * IDLE_HANDOFF + 1_000);
    expect(s.out).toEqual([{ to: 't1', message: { type: 'error', action: 'handToBot', reason: 'notIdle' } }]);
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + 3 * IDLE_HANDOFF);
    expect(memberNamed(s, 't1', 'Dita').botControlled).toBe(true);
  });

  test('o snapshot diz há quanto tempo cada pessoa não age, para quem decide passar uma cadeira', () => {
    const s = scripted();
    s.feed({ kind: 'message', token: 't1', message: { type: 'raise' } }, T0 + 10_000);
    expect(s.snapshotFor('t3')!.members.map((m) => [m.nickname, m.idle])).toEqual([['Zé', 0], ['Dita', 10_000], ['Nena', 10_000], ['Tião', 0], ['Bastião', 0]]);
  });

  test('na revanche ninguém mais é bot: quem caiu volta ao lobby na própria cadeira com a tolerância de sempre, e depois dela a cadeira fica livre', () => {
    const s = scripted();
    s.feed({ kind: 'disconnect', token: 't2' });
    s.fire(dropOf(s)); // um bot joga por Dita até o fim
    run(s, undefined, [['t1', 0]]);
    expect(s.state.members.find((m) => m.token === 't2')).toMatchObject({ seat: 2, connected: false, botControlled: true });
    s.say('t1', { type: 'rematch' });
    expect(s.snapshotFor('t1')!.members.map((m) => [m.nickname, m.seat, m.connected, m.botControlled])).toEqual([['Zé', 0, true, false], ['Dita', 2, false, false], ['Nena', null, true, false]]);
    expect(s.state.timers).toContainEqual({ kind: 'drop', token: 't2', at: s.now + DISCONNECT_GRACE });
    s.fire(dropOf(s));
    expect(s.snapshotFor('t1')!.members.map((m) => m.nickname)).toEqual(['Zé', 'Nena']);
    s.sit('t3', 0);
    expect(s.snapshotFor('t3')!.members.map((m) => [m.nickname, m.seat])).toEqual([['Zé', 0], ['Nena', 2]]);
  });
});

describe('partida online: fantasmas', () => {
  const memberNamed = (s: Sim, token: string, name: string) => s.snapshotFor(token)!.members.find((m) => m.nickname === name)!;
  const betweenHands = (x: Sim) => x.game.hand?.phase === 'over';

  test('fantasma toma a cadeira de um bot entre mãos e passa a jogar por ela, na dupla daquela cadeira', () => {
    const s = scripted(); // Nena (t3) assiste; Tião (m4) é o bot da cadeira 1
    run(s, betweenHands);
    s.out = [];
    s.say('t3', { type: 'takeBotSeat', seat: 1 });
    expect(s.errorsFor('t3')).toEqual([]);
    const snap = s.snapshotFor('t1')!;
    expect(snap.members.map((m) => [m.nickname, m.seat, m.bot])).toEqual([['Zé', 0, false], ['Dita', 2, false], ['Nena', 1, false], ['Bastião', 3, true]]);
    expect(s.events).toContainEqual({ type: 'seated', id: 'm3', nickname: 'Nena', seat: 1 });
    // a mão seguinte vem como sempre, e Nena só vê as próprias cartas
    s.fire(s.gameTimer()!);
    const hand = s.snapshotFor('t3')!.game!.hand!;
    expect(hand.cards[1].every((c) => c !== null)).toBe(true);
    expect(hand.cards[0]).toEqual([null, null, null]);
    // e joga pela cadeira 1 quando chega a vez dela (mão 2: Zé abre; depois é a cadeira 1)
    s.say('t1', { type: 'play', id: strongest(s.snapshotFor('t1')!.game!.hand!.cards[0]), covered: false });
    s.out = [];
    s.say('t3', { type: 'play', id: hand.cards[1][0]!, covered: false });
    expect(s.errorsFor('t3')).toEqual([]);
    expect(s.eventsFor('t1')).toContainEqual(expect.objectContaining({ type: 'play', seat: 1 }));
  });

  test('no meio da mão a cadeira do bot não se toma: a recusa diz que a mão está em curso', () => {
    const s = scripted();
    const before = structuredClone(s.state);
    s.out = [];
    s.say('t3', { type: 'takeBotSeat', seat: 1 });
    expect(s.out).toEqual([{ to: 't3', message: { type: 'error', action: 'takeBotSeat', reason: 'midHand' } }]);
    expect(s.state).toEqual(before);
  });

  test('só fantasma, só na partida, só cadeira de bot de verdade (não a de quem um bot joga por), e nunca no fim de jogo', () => {
    const s = nosContraBots();
    for (const [n, { cards }] of Object.entries(SCRIPT)) s.decks[Number(n)] = cards;
    s.out = [];
    s.say('t3', { type: 'takeBotSeat', seat: 1 });
    expect(s.out).toEqual([{ to: 't3', message: { type: 'error', action: 'takeBotSeat', reason: 'notPlaying' } }]);
    s.start('t1');
    s.feed({ kind: 'message', token: 't1', message: { type: 'handToBot', member: 'm2' } }, T0 + IDLE_HANDOFF); // um bot joga por Dita (cadeira 2)
    run(s, betweenHands, [['t1', 0]]);
    s.out = [];
    s.say('t1', { type: 'takeBotSeat', seat: 1 }); // quem senta
    s.say('t3', { type: 'takeBotSeat', seat: 2 }); // a cadeira continua sendo de Dita
    s.say('t3', { type: 'takeBotSeat', seat: 0 }); // a de Zé
    s.connect('t4'); s.say('t4', { type: 'takeBotSeat', seat: 1 }); // visitante sem apelido
    expect(s.out.filter((o) => o.message.type === 'error').map((o) => [o.to, (o.message as { reason: string }).reason])).toEqual([['t1', 'illegal'], ['t3', 'illegal'], ['t3', 'illegal']]);
    expect(s.state.members.find((m) => m.nickname === 'Nena')!.seat).toBeNull();
    run(s, undefined, [['t1', 0]]);
    s.out = [];
    s.say('t3', { type: 'takeBotSeat', seat: 1 });
    expect(s.out).toEqual([{ to: 't3', message: { type: 'error', action: 'takeBotSeat', reason: 'illegal' } }]);
  });

  test('presença não passa pela sala: não muda nada nem adia a morte', () => {
    const s = scripted();
    const before = structuredClone(s.state);
    s.feed({ kind: 'message', token: 't3', message: { type: 'presence', presence: { x: 1, y: 0, z: 2, yaw: 0, pitch: 0 } } }, T0 + 5_000);
    expect(s.state).toEqual(before);
  });
});
