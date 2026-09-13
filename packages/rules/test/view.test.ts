import { describe, expect, test } from 'bun:test';
import { createGame, startHand, viewFor } from '../src';

const fixed = () => 0.5;

function dealt() {
  const g = createGame();
  startHand(g, fixed);
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
    startHand(g, fixed);
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
});
