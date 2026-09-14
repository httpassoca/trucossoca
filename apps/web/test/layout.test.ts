import { describe, expect, test } from 'bun:test';
import { createGame, startHand, viewFor, type Seat } from '@truco/rules';
import { buildCards, monteSpot, TABLE_R, TABLE_TOP } from '../src/lib/scene/builders';
import { choreographDeal, DEAL_TOTAL, dealOrder, handPose, layoutCards, resetLayout } from '../src/lib/scene/layout';
import { isMoving, stepCard } from '../src/lib/scene/tween';
import { seeded } from './seeded';

/** Uma mão nova vista por uma cadeira: o carteador fixo, para a coreografia ser previsível. */
function hand(dealer: Seat, viewer: Seat | 'all' = 0) {
  const g = createGame();
  startHand(g, seeded(7), { dealer });
  return viewFor(g, viewer);
}

/** Roda a cena até `ms` depois de `t0`, em passos de 1/60 s. */
function run(cards: ReturnType<typeof buildCards>, t0: number, ms: number) {
  for (let t = t0; t <= t0 + ms; t += 1000 / 60) for (const c of Object.values(cards)) stepCard(c, t);
}

describe('coreografia de dar as cartas', () => {
  test('todas as 40 cartas param onde o layout as quer: 12 na mão de cada cadeira, 28 no monte na frente da mão', () => {
    resetLayout();
    const cards = buildCards(), g = hand(1);
    const t0 = 1000;
    choreographDeal(g, cards, t0);
    layoutCards(g, { view: 0, sel: 0, myTurn: false, lifted: [false, false, false, false], dealing: true }, cards);
    expect(Object.values(cards).every(isMoving)).toBe(true);
    run(cards, t0, DEAL_TOTAL + 50);
    expect(Object.values(cards).some(isMoving)).toBe(false);
    const monte = monteSpot(g.mao);
    let inMonte = 0, inHands = 0;
    for (const c of Object.values(cards)) {
      const d = Math.hypot(c.position.x - monte.x, c.position.z - monte.z);
      if (d < 0.01) inMonte++;
      else if (Math.hypot(c.position.x, c.position.z) > 1.05 && c.position.y < TABLE_TOP + 0.1) inHands++;
      expect(c.position.distanceTo(c.userData.tp)).toBeLessThan(1e-6);
    }
    expect(inMonte).toBe(28);
    expect(inHands).toBe(12);
  });

  test('a mão recebe a primeira carta, e a ordem segue para a direita a partir dela', () => {
    expect(dealOrder(2)).toEqual([2, 3, 0, 1]);
    resetLayout();
    const cards = buildCards(), g = hand(3, 'all'), t0 = 0; // carteador 3: mão 0
    choreographDeal(g, cards, t0);
    const firstArrival = (s: Seat) => Math.min(...g.hand!.cards[s].map((id) => id ? cards[id].userData.path.at(-1)!.t0 : Infinity));
    expect(firstArrival(0)).toBeLessThan(firstArrival(1));
    expect(firstArrival(1)).toBeLessThan(firstArrival(2));
    expect(firstArrival(2)).toBeLessThan(firstArrival(3));
    expect(firstArrival(3)).toBeLessThan(firstArrival(0) + 4 * 150);
  });

  test('o layout seguinte não mexe nos caminhos (mesmos destinos)', () => {
    resetLayout();
    const cards = buildCards(), g = hand(0);
    choreographDeal(g, cards, 0);
    const lens = Object.values(cards).map((c) => c.userData.path.length);
    layoutCards(g, { view: 0, sel: 0, myTurn: true, lifted: [false, false, false, false], dealing: true }, cards);
    expect(Object.values(cards).map((c) => c.userData.path.length)).toEqual(lens);
  });
});

describe('poses das cartas na mão', () => {
  test('em repouso ficam baixas junto à beira da mesa; levantadas, diante do rosto, dentro da mesa', () => {
    // handPose devolve um buffer compartilhado: copia antes de pedir outra pose
    const rest = { p: handPose(0, 1, 3, 'rest', false).p.clone() }, lift = { p: handPose(0, 1, 3, 'lift', false).p.clone() };
    expect(rest.p.y).toBeLessThan(TABLE_TOP + 0.12);
    expect(Math.hypot(rest.p.x, rest.p.z)).toBeLessThan(TABLE_R);
    expect(lift.p.y).toBeGreaterThan(1.0);
    expect(Math.hypot(lift.p.x, lift.p.z)).toBeLessThan(TABLE_R);
    expect(handPose(0, 0, 3, 'lift', true).p.y).toBeGreaterThan(handPose(0, 0, 3, 'lift', false).p.y);
  });

  test('levantar as cartas de uma cadeira só move as dela', () => {
    resetLayout();
    const cards = buildCards(), g = hand(3, 'all');
    // o layout carimba os caminhos com o relógio de verdade (`performance.now`): a simulação parte dele, não de zero
    layoutCards(g, { view: 0, sel: 0, myTurn: false, lifted: [false, false, false, false], dealing: false }, cards);
    run(cards, performance.now(), 2000);
    expect(Object.values(cards).some(isMoving)).toBe(false);
    layoutCards(g, { view: 0, sel: 0, myTurn: false, lifted: [false, true, false, false], dealing: false }, cards);
    const moving = Object.values(cards).filter(isMoving).map((c) => c.userData.id);
    expect(moving.sort()).toEqual([...g.hand!.cards[1]].sort());
  });
});
