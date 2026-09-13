import { describe, expect, test } from 'bun:test';
import { createGame, defaultRules, eventsFor, playCard, startHand, takeEvents, viewFor, type CardId, type GameEvent, type PlayView } from '../src';
import { deckFor } from './deck';

const fixed = () => 0.5;

/** Mão dada pela cadeira 3: a 0 abre. */
function dealt() {
  const g = createGame();
  startHand(g, fixed, { dealer: 3 });
  return g;
}

describe('viewFor: o que cada um vê da mão', () => {
  test('uma cadeira vê as próprias cartas, as outras ocultas e só a contagem do monte', () => {
    const g = dealt();
    const v = viewFor(g, 1);
    const h = v.hand!;
    expect(h.cards[1]).toEqual(g.hand!.cards[1]);
    for (const s of [0, 2, 3]) expect(h.cards[s]).toEqual([null, null, null]);
    expect(h.stock).toBe(28);
    expect(JSON.stringify(v)).not.toContain(g.hand!.stock[0]);
  });

  test("'all' vê tudo e 'none' não vê carta nenhuma", () => {
    const g = dealt();
    expect(viewFor(g, 'all').hand!.cards).toEqual(g.hand!.cards);
    expect(viewFor(g, 'none').hand!.cards.every((c) => c.every((x) => x === null))).toBe(true);
  });

  test('na decisão da mão de dez a cadeira vê as cartas do parceiro, e só ela', () => {
    const g = createGame();
    g.scores = [10, 0];
    startHand(g, fixed, { dealer: 3 });
    expect(g.hand!.special).toBe('dez');
    const mine = viewFor(g, 2).hand!;
    expect(mine.cards[0]).toEqual(g.hand!.cards[0]);
    expect(mine.cards[1]).toEqual([null, null, null]);
    const theirs = viewFor(g, 1).hand!;
    expect(theirs.cards[0]).toEqual([null, null, null]);
    expect(theirs.cards[3]).toEqual([null, null, null]); // dupla que não decide não olha o parceiro
  });

  test('a visão é uma cópia: mexer nela não mexe no jogo', () => {
    const g = dealt();
    const v = viewFor(g, 0);
    v.hand!.cards[0].pop();
    (v.hand!.played[0] as unknown[]).push({});
    expect(g.hand!.cards[0]).toHaveLength(3);
    expect(g.hand!.played[0]).toHaveLength(0);
    expect(v).not.toHaveProperty('events');
  });

  test('sem mão, a visão tem mão nula', () => {
    expect(viewFor(createGame(), 0).hand).toBeNull();
  });

  test('a visão leva o carteador e o mão, como o estado', () => {
    const g = createGame(); startHand(g, () => 0.3);
    const v = viewFor(g, 'none');
    expect(v.dealer).toBe(1);
    expect(v.mao).toBe(2);
    expect(viewFor(g, 0).dealer).toBe(1);
  });
});

/** Mão em que a cadeira 0 já ganhou a 1ª vaza e a cadeira 0 abre a 2ª com carta coberta. */
function withCoveredPlay() {
  const g = createGame({ ...defaultRules, coverFromTrick: 2 });
  const cards: CardId[][] = [['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']];
  startHand(g, fixed, { deck: deckFor(cards, 0), dealer: 3 });
  playCard(g, 0, '4c'); playCard(g, 1, 'Kc'); playCard(g, 2, 'Ks'); playCard(g, 3, '2c');
  takeEvents(g);
  playCard(g, 0, '4d', true, () => 0.25);
  playCard(g, 1, '4s');
  return g;
}

describe('viewFor: a carta coberta', () => {
  test('quem jogou a coberta vê o id dela; as outras cadeiras e quem não vê nada recebem a jogada sem id', () => {
    const g = withCoveredPlay();
    const real = g.hand!.played[1][0];
    expect(real.covered).toBe(true);
    expect(viewFor(g, 0).hand!.played[1][0]).toEqual(real);
    expect(viewFor(g, 'all').hand!.played[1][0]).toEqual(real);
    for (const from of [1, 2, 3, 'none'] as const) {
      const seen = viewFor(g, from).hand!.played[1][0];
      expect(seen).toEqual({ ...real, id: null } as PlayView);
      expect(JSON.stringify(viewFor(g, from))).not.toContain('"4d"');
    }
    // a carta aberta da mesma vaza continua inteira
    expect(viewFor(g, 3).hand!.played[1][1]).toEqual(g.hand!.played[1][1]);
  });

  test('eventsFor esconde o id da coberta de quem não a jogou e deixa o resto igual', () => {
    const g = withCoveredPlay();
    const events = takeEvents(g); // a coberta da cadeira 0 e a carta aberta da cadeira 1
    expect(events.map((e) => e.type)).toEqual(['play', 'play']);
    const cover = events[0] as GameEvent & { type: 'play' };
    expect(cover.covered).toBe(true);
    expect(eventsFor(events, 0)).toEqual(events);
    expect(eventsFor(events, 'all')).toEqual(events);
    for (const from of [1, 2, 3, 'none'] as const) {
      const seen = eventsFor(events, from);
      expect(seen[0]).toEqual({ ...cover, id: null });
      expect(seen[1]).toEqual(events[1]);
    }
    expect(events[0]).toBe(cover); // não mexe na lista recebida
  });
});

describe('playCard: a semente de onde a carta cai', () => {
  test('cada jogada guarda uma semente inteira tirada do rng, no estado e no evento', () => {
    const g = dealt();
    takeEvents(g);
    const id = g.hand!.cards[0][0];
    expect(playCard(g, 0, id, false, () => 0.25)).toBe(true);
    const play = g.hand!.played[0][0];
    expect(Number.isInteger(play.seed)).toBe(true);
    expect(play.seed).toBeGreaterThanOrEqual(0);
    const [ev] = takeEvents(g);
    expect(ev).toEqual({ type: 'play', seat: 0, id, covered: false, kind: 'lead', seed: play.seed });
    // rng diferente, semente diferente
    const g2 = dealt();
    playCard(g2, 0, g2.hand!.cards[0][0], false, () => 0.75);
    expect(g2.hand!.played[0][0].seed).not.toBe(play.seed);
  });
});
