import { describe, expect, test } from 'bun:test';
import type { GameEvent, Rules, Seat } from '@truco/rules';
import { defaultRules } from '@truco/rules';
import { HAND_PAUSE, LocalTable, type LocalSettings } from '../src/lib/table/local';
import type { Table, TableSnapshot } from '../src/lib/table/table';
import { ManualClock } from './manual-clock';
import { seeded } from './seeded';


function setup(seed = 1, settings: Partial<LocalSettings> = {}) {
  const clock = new ManualClock();
  const opts: LocalSettings = { rules: { ...defaultRules } as Rules, bots: true, botDelay: 800, ...settings };
  const table: Table = new LocalTable(opts, { rng: seeded(seed), clock });
  return { clock, table, settings: opts };
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

  test('bots esperam o ritmo e a mão nova espera a pausa', () => {
    const { clock, table, settings } = setup(3);
    let lastChange = 0, handEndAt = -1;
    const botWaits: number[] = [], pauses: number[] = [];
    table.subscribe((_s, ev) => {
      for (const e of ev) {
        if ((e.type === 'play' || e.type === 'raise' || e.type === 'respond') && e.seat !== 0) botWaits.push(clock.now - lastChange);
        if (e.type === 'handEnd') handEndAt = clock.now;
        if (e.type === 'newHand' && handEndAt >= 0) pauses.push(clock.now - handEndAt);
      }
      lastChange = clock.now;
    });
    scriptedPerson(table, clock, []);

    table.newGame();
    clock.run();

    expect(botWaits.length).toBeGreaterThan(0);
    expect(Math.min(...botWaits)).toBeGreaterThanOrEqual(settings.botDelay);
    expect(pauses.length).toBeGreaterThan(0);
    expect(Math.min(...pauses)).toBe(HAND_PAUSE);
  });

  test('sem bots, a cadeira local segue quem tem de agir', () => {
    const { clock, table } = setup(1, { bots: false });
    table.newGame();
    const h = table.snapshot.game.hand!;
    expect(table.snapshot.seat).toBe(h.turn);
    expect(clock.pending).toBe(0); // ninguém joga sozinho

    const first = table.snapshot.seat;
    table.play(h.cards[first][0]);
    expect(table.snapshot.game.hand!.played[0]).toHaveLength(1);
    expect(table.snapshot.seat).toBe(((first + 1) % 4) as Seat);
    expect(table.snapshot.acting).toBe(table.snapshot.seat);
  });

  test('com bots, a cadeira local fica no 0 e os bots jogam as outras', () => {
    const { clock, table } = setup(1);
    table.newGame();
    const h = table.snapshot.game.hand!;
    expect(h.turn).toBe(0);
    table.play(h.cards[0][0]);
    expect(table.snapshot.seat).toBe(0);
    expect(table.snapshot.acting).toBe(1);
    expect(clock.pending).toBe(1);
    for (let i = 0; i < 3; i++) clock.step(); // os três bots jogam
    expect(table.snapshot.game.hand!.played[0]).toHaveLength(4);
  });

  test('coberta só liga quando a regra permite, e desliga ao jogar', () => {
    const { table } = setup(1, { bots: false });
    table.newGame();
    table.toggleCover();
    expect(table.snapshot.coverNext).toBe(false); // 1ª vaza: não pode
    for (let i = 0; i < 4; i++) table.play(table.snapshot.game.hand!.cards[table.snapshot.seat][0]);
    expect(table.snapshot.game.hand!.played).toHaveLength(2);
    if (table.snapshot.game.hand!.phase !== 'play') return; // mão pode ter acabado no empate; nada a testar
    table.toggleCover();
    expect(table.snapshot.coverNext).toBe(true);
    const s = table.snapshot.seat;
    table.play(table.snapshot.game.hand!.cards[s][0]);
    expect(table.snapshot.coverNext).toBe(false);
    expect(table.snapshot.game.hand!.played[1][0].covered).toBe(true);
  });
});

describe('LocalTable: configuração ao vivo', () => {
  test('ligar os bots de volta devolve a pessoa à cadeira 0', () => {
    const { table, settings, clock } = setup(1, { bots: false });
    table.newGame();
    table.play(table.snapshot.game.hand!.cards[0][0]);
    expect(table.snapshot.seat).toBe(1);

    settings.bots = true;
    table.newGame();
    expect(table.snapshot.seat).toBe(0);
    expect(table.snapshot.acting).toBe(0);
    table.play(table.snapshot.game.hand!.cards[0][0]);
    expect(table.snapshot.game.hand!.played[0]).toHaveLength(1);
    expect(clock.pending).toBe(1); // bot da cadeira 1 agendado
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
