import { describe, expect, test } from 'bun:test';
import { DEAL_MS } from '@truco/protocol';
import type { GameEvent, Rules, Seat } from '@truco/rules';
import { defaultRules } from '@truco/rules';
import { HAND_PAUSE, LocalTable, type LocalSettings } from '../src/lib/table/local';
import type { Table, TableSnapshot } from '../src/lib/table/table';
import { ManualClock } from './manual-clock';
import { seeded } from './seeded';


function setup(seed = 1, settings: Partial<LocalSettings> = {}) {
  const clock = new ManualClock();
  const opts: LocalSettings = { rules: { ...defaultRules } as Rules, bots: true, botPace: 1, ...settings };
  const table = new LocalTable(opts, { rng: seeded(seed), clock });
  return { clock, table: table as Table, local: table, settings: opts };
}

/** Pessoa roteirizada na cadeira local: joga a primeira carta, aceita truco, joga a mão de dez. Age no timer, como um teclado. */
function scriptedPerson(table: Table, clock: ManualClock, acted: GameEvent[]) {
  const listener = (snap: TableSnapshot, events: GameEvent[]) => {
    for (const e of events) if (e.type === 'play' && e.seat === snap.seat) acted.push(e);
    const h = snap.game.hand;
    if (!h || snap.game.over || snap.acting !== snap.seat) return;
    clock.setTimeout(() => {
      const s = table.snapshot, hh = s.game.hand!;
      if (hh.phase === 'play' && hh.turn === s.seat) table.play(hh.cards[s.seat][0]);
      else if (hh.phase === 'respond') table.respond('accept');
      else if (hh.phase === 'dezDecision') table.decideDez('play');
    }, 0);
  };
  return table.subscribe(listener);
}

describe('LocalTable', () => {
  test('uma partida inteira contra bots chega ao fim de jogo', () => {
    const { clock, table } = setup(7);
    const events: GameEvent[] = [];
    const mine: GameEvent[] = [];
    table.subscribe((_s, ev) => events.push(...ev));
    scriptedPerson(table, clock, mine);

    table.newGame();
    clock.run();

    const g = table.snapshot.game;
    expect(g.over).toBe(true);
    expect(g.winner === 0 || g.winner === 1).toBe(true);
    expect(g.scores[g.winner!]).toBeGreaterThanOrEqual(g.rules.target);
    expect(g.scores[1 - g.winner!]).toBeLessThan(g.rules.target);
    expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'handEnd')).toHaveLength(g.handNo);
    expect(events.filter((e) => e.type === 'newHand')).toHaveLength(g.handNo);
    expect(mine.length).toBeGreaterThan(0);
    expect(table.snapshot.seat).toBe(0);
    expect(table.snapshot.acting).toBe(-1);
    expect(clock.pending).toBe(0);
  });

  test('bots pensam no ritmo, esperam as cartas serem dadas na primeira ação da mão, e a mão nova espera a pausa', () => {
    for (const pace of [0.5, 1, 2]) {
      const { clock, table } = setup(3, { botPace: pace });
      let lastChange = 0, handEndAt = -1, fresh = false;
      const botWaits: number[] = [], firstWaits: number[] = [], pauses: number[] = [];
      table.subscribe((_s, ev) => {
        for (const e of ev) {
          if ((e.type === 'play' || e.type === 'raise' || e.type === 'respond') && e.seat !== 0) (fresh ? firstWaits : botWaits).push(clock.now - lastChange);
          if (e.type === 'handEnd') handEndAt = clock.now;
          if (e.type === 'newHand' && handEndAt >= 0) pauses.push(clock.now - handEndAt);
          fresh = e.type === 'newHand'; // a ação seguinte ao newHand é a primeira da mão
        }
        lastChange = clock.now;
      });
      scriptedPerson(table, clock, []);

      table.newGame();
      clock.run();

      expect(botWaits.length).toBeGreaterThan(0);
      expect(Math.min(...botWaits)).toBeGreaterThanOrEqual(1000 * pace);
      expect(Math.max(...botWaits)).toBeLessThan(4000 * pace);
      expect(firstWaits.length).toBeGreaterThan(0);
      expect(Math.min(...firstWaits)).toBeGreaterThanOrEqual(DEAL_MS + 1000 * pace);
      expect(Math.max(...firstWaits)).toBeLessThan(DEAL_MS + 4000 * pace);
      expect(pauses.length).toBeGreaterThan(0);
      expect(Math.min(...pauses)).toBe(HAND_PAUSE);
    }
  });

  test('sem bots, a cadeira local segue quem tem de agir', () => {
    const { clock, table } = setup(1, { bots: false });
    table.newGame();
    const h = table.snapshot.game.hand!;
    expect(table.snapshot.seat).toBe(h.turn);
    expect(clock.pending).toBe(0); // ninguém joga sozinho

    const first = table.snapshot.seat!;
    table.play(h.cards[first][0]!);
    expect(table.snapshot.game.hand!.played[0]).toHaveLength(1);
    expect(table.snapshot.seat).toBe(((first + 1) % 4) as Seat);
    expect(table.snapshot.acting).toBe(table.snapshot.seat);
  });

  test('com bots, a cadeira local fica no 0 e os bots jogam as outras', () => {
    const { clock, table } = setup(4); // com esta semente o carteador sorteado é a cadeira 3: a pessoa abre
    table.newGame();
    const h = table.snapshot.game.hand!;
    expect(h.turn).toBe(0);
    expect(clock.pending).toBe(0); // a mesa espera a pessoa
    table.play(h.cards[0][0]!);
    expect(table.snapshot.seat).toBe(0);
    expect(table.snapshot.acting).toBe(1);
    expect(clock.pending).toBe(1);
    for (let i = 0; i < 3; i++) clock.step(); // os três bots jogam
    expect(table.snapshot.game.hand!.played[0]).toHaveLength(4);
    expect(table.snapshot.seats.map((x) => [x.name, x.bot])).toEqual([['Você', false], ['Tião', true], ['Dita', true], ['Zé', true]]);
  });

  test('o carteador da primeira mão é sorteado e depois passa para a direita; a mão nova diz quem dá e quem corta', () => {
    const { clock, table } = setup(5);
    const hands: [Seat, Seat, Seat][] = [];
    table.subscribe((_s, ev) => { for (const e of ev) if (e.type === 'newHand') hands.push([e.dealer, e.cutter, e.mao]); });
    scriptedPerson(table, clock, []);
    table.newGame();
    clock.run();
    expect(hands.length).toBeGreaterThan(1);
    for (let i = 1; i < hands.length; i++) expect(hands[i][0]).toBe(hands[i - 1][2]); // o mão de uma mão dá a seguinte
    for (const [dealer, cutter, mao] of hands) { expect(cutter).toBe(((dealer + 3) % 4) as Seat); expect(mao).toBe(((dealer + 1) % 4) as Seat); }
    expect(table.snapshot.game.dealer).toBe(hands[hands.length - 1][0]);
  });

  test('coberta só liga quando a regra permite, e desliga ao jogar', () => {
    const { table } = setup(1, { bots: false });
    table.newGame();
    table.toggleCover();
    expect(table.snapshot.coverNext).toBe(false); // 1ª vaza: não pode
    for (let i = 0; i < 4; i++) table.play(table.snapshot.game.hand!.cards[table.snapshot.seat!][0]!);
    expect(table.snapshot.game.hand!.played).toHaveLength(2);
    if (table.snapshot.game.hand!.phase !== 'play') return; // mão pode ter acabado no empate; nada a testar
    table.toggleCover();
    expect(table.snapshot.coverNext).toBe(true);
    const s = table.snapshot.seat!;
    table.play(table.snapshot.game.hand!.cards[s][0]!);
    expect(table.snapshot.coverNext).toBe(false);
    expect(table.snapshot.game.hand!.played[1][0].covered).toBe(true);
  });
});

describe('LocalTable: configuração ao vivo', () => {
  test('ligar os bots de volta devolve a pessoa à cadeira 0', () => {
    const { table, settings, clock } = setup(1, { bots: false });
    table.newGame();
    const first = table.snapshot.seat!;
    table.play(table.snapshot.game.hand!.cards[first][0]!);
    expect(table.snapshot.seat).toBe(((first + 1) % 4) as Seat);

    settings.bots = true;
    table.newGame();
    expect(table.snapshot.seat).toBe(0);
    const h = table.snapshot.game.hand!;
    if (h.turn === 0) {
      expect(table.snapshot.acting).toBe(0);
      table.play(h.cards[0][0]!);
      expect(table.snapshot.game.hand!.played[0]).toHaveLength(1);
    }
    expect(clock.pending).toBe(1); // o bot seguinte agendado
  });

  test('regras chegam como um objeto novo a cada mão (snapshot não compartilha a escada com a configuração)', () => {
    const { table, settings } = setup(1);
    table.newGame();
    expect(table.snapshot.game.rules.ladder).not.toBe(settings.rules.ladder);
    expect(table.snapshot.game.rules.ladder).toEqual(settings.rules.ladder);
  });
});

describe('perspectiva', () => {
  test('com bots, a pessoa só conhece as próprias cartas; sem bots (debug), todas', () => {
    const { table } = setup(1);
    table.newGame();
    const h = table.snapshot.game.hand!;
    expect(h.cards[0].every((c) => c !== null)).toBe(true);
    for (const s of [1, 2, 3] as const) expect(h.cards[s].every((c) => c === null)).toBe(true);
    const all = setup(1, { bots: false }).table;
    all.newGame();
    expect(all.snapshot.game.hand!.cards.every((held) => held.every((c) => c !== null))).toBe(true);
  });
});

describe('LocalTable: assistir (fantasma com quatro bots)', () => {
  const allBots = (snap: TableSnapshot) => snap.seats.every((s) => s.bot);
  const allVisible = (snap: TableSnapshot) => snap.game.hand!.cards.every((held) => held.every((c) => c !== null));

  test('quem assiste não tem cadeira, vê todas as cartas, e os quatro bots jogam uma partida inteira sozinhos', () => {
    const { clock, table } = setup(7, { watch: true, you: 'Ana' });
    expect(table.snapshot.seat).toBeNull();
    expect(table.snapshot.seats.map((s) => [s.name, s.bot])).toEqual([['Nena', true], ['Tião', true], ['Dita', true], ['Zé', true]]);
    const events: GameEvent[] = [];
    const snaps: TableSnapshot[] = [];
    table.subscribe((s, ev) => { snaps.push(s); events.push(...ev); });
    table.newGame();
    expect(table.snapshot.acting).toBe(table.snapshot.game.hand!.turn);
    expect(table.snapshot.canRaise).toBe(false);
    clock.run();
    const g = table.snapshot.game;
    expect(g.over).toBe(true);
    expect(g.scores[g.winner!]).toBeGreaterThanOrEqual(g.rules.target);
    expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'newHand')).toHaveLength(g.handNo);
    for (const seat of [0, 1, 2, 3]) expect(events.some((e) => e.type === 'play' && e.seat === seat)).toBe(true);
    expect(snaps.every((s) => s.seat === null && allBots(s))).toBe(true);
    expect(snaps.filter((s) => s.game.hand).every(allVisible)).toBe(true);
    expect(clock.pending).toBe(0);
  });

  test('as jogadas de quem assiste não passam', () => {
    const { table } = setup(2, { watch: true });
    table.newGame();
    const before = table.snapshot;
    const h = before.game.hand!;
    table.play(h.cards[h.turn][0]!); table.raise(); table.respond('accept'); table.decideDez('play');
    expect(table.snapshot).toBe(before);
  });

  test('sentar no meio da mão espera a mão acabar; sentado, a pessoa joga por aquela cadeira e os outros três seguem bots', () => {
    const { clock, table, local } = setup(4, { watch: true, you: 'Ana' });
    const events: GameEvent[] = [];
    table.subscribe((_s, ev) => events.push(...ev));
    table.newGame();
    expect(table.snapshot.game.hand!.phase).not.toBe('over');
    table.takeBotSeat(2);
    expect(table.snapshot.seat).toBeNull();
    expect(local.wantsSeat).toBe(2);
    expect(table.snapshot.seats[2].bot).toBe(true);
    clock.runUntil(() => table.snapshot.game.hand!.phase === 'over');
    expect(table.snapshot.seat).toBe(2);
    expect(local.wantsSeat).toBeNull();
    expect(table.snapshot.seats.map((s) => [s.name, s.bot])).toEqual([['Nena', true], ['Tião', true], ['Ana', false], ['Zé', true]]);
    expect(clock.pending).toBe(1); // a pausa continua marcada, não recomeçou
    const handEndAt = clock.now;
    clock.step();
    expect(clock.now - handEndAt).toBe(HAND_PAUSE);
    // dali em diante: só as próprias cartas, e a mesa espera por ela quando é a vez da cadeira 2
    const h = table.snapshot.game.hand!;
    expect(h.cards[2].every((c) => c !== null)).toBe(true);
    for (const other of [0, 1, 3] as const) expect(h.cards[other].every((c) => c === null)).toBe(true);
    const mine: GameEvent[] = [];
    scriptedPerson(table, clock, mine);
    clock.run();
    expect(table.snapshot.game.over).toBe(true);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e) => e.type === 'play' && e.seat === 2)).toBe(true);
    expect(table.snapshot.seat).toBe(2);
  });

  test('entre mãos (ou antes da primeira) senta na hora; desistir cancela a intenção; quem senta não pede cadeira', () => {
    const { clock, table, local } = setup(4, { watch: true });
    table.takeBotSeat(1); // sem mão ainda
    expect(table.snapshot.seat).toBe(1);
    table.takeBotSeat(3); // já senta: nada muda
    expect(table.snapshot.seat).toBe(1);

    const again = setup(4, { watch: true });
    again.table.newGame();
    again.table.takeBotSeat(3);
    again.table.takeBotSeat(null);
    expect(again.local.wantsSeat).toBeNull();
    again.clock.runUntil(() => again.table.snapshot.game.hand!.phase === 'over');
    expect(again.table.snapshot.seat).toBeNull(); // a intenção caiu antes
    again.table.takeBotSeat(0);
    expect(again.table.snapshot.seat).toBe(0);
    expect(again.table.snapshot.seats[0]).toEqual({ name: 'Você', bot: false, botControlled: false });
    void clock; void local;
  });

  test('uma partida nova devolve quem assistia ao lugar de fantasma; sem `watch`, a mesa é a de sempre', () => {
    const { clock, table, settings } = setup(4, { watch: true });
    table.takeBotSeat(2);
    expect(table.snapshot.seat).toBe(2);
    table.newGame();
    expect(table.snapshot.seat).toBeNull();
    expect(table.snapshot.seats.every((s) => s.bot)).toBe(true);
    clock.run();
    expect(table.snapshot.game.over).toBe(true);
    settings.watch = false; // lida ao vivo: a próxima partida é jogada
    table.newGame();
    expect(table.snapshot.seat).toBe(0);
    expect(table.snapshot.seats[0].bot).toBe(false);
    const plain = setup(1, { watch: false }).table;
    expect(plain.snapshot.seat).toBe(0);
  });
});

describe('LocalTable: cenário', () => {
  test('nasce com o cenário pedido (ou o bar) e trocar publica um snapshot novo na hora', () => {
    const { table } = setup(1, { scenery: 'graveyard' });
    expect(table.snapshot.scenery).toBe('graveyard');
    const seen: string[] = [];
    table.subscribe((s) => seen.push(s.scenery));
    table.setScenery('bar');
    expect(seen).toEqual(['bar']);
    expect(table.snapshot.scenery).toBe('bar');
    table.setScenery('bar');
    expect(seen).toEqual(['bar']);
    expect(setup(1).table.snapshot.scenery).toBe('bar');
  });
});
