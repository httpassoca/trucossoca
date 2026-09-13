import { describe, expect, test } from 'bun:test';
import {
  createGame, cutterOf, dealOrder, defaultRules, handUntouched, handWinner, canRaise, makeDeck, nextSeat, playCard, raise, respond, responderSeat, startHand, strength,
  decideDez, takeEvents, thinkTime, type CardId, type Rules, type Seat, type Team,
} from '../src';
import { deckFor } from './deck';

const R = defaultRules;
const rng = () => 0.5;
/** Mão com o carteador na cadeira 3: a cadeira 0 é o mão e abre. */
function game(cards: CardId[][], rules: Partial<Rules> = {}, scores: [number, number] = [0, 0]) {
  const g = createGame({ ...R, ...rules }); g.scores = scores;
  startHand(g, rng, { deck: deckFor(cards, 0), dealer: 3 });
  return g;
}

describe('força das cartas', () => {
  test('manilhas fixas acima de tudo, na ordem zap > 7♥ > A♠ > 7♦', () => {
    const order: CardId[] = ['4c', '7h', 'As', '7d', '3c', '2c', 'Ac', 'Kc', 'Jc', 'Qc', '7c', '6c', '5c', '4d'];
    for (let i = 1; i < order.length; i++) expect(strength(order[i - 1], R)).toBeGreaterThan(strength(order[i], R));
  });
  test('sem manilhas fixas o 4♣ é a pior carta', () => {
    expect(strength('4c', { fixedManilhas: false })).toBe(1);
  });
});

describe('quem ganha a mão', () => {
  const t = (r: (Team | null)[], want: Team | null | undefined) => expect(handWinner(r)).toBe(want);
  test('duas vazas seguidas', () => { t([0, 0], 0); t([1, 1], 1); });
  test('1ª empata → 2ª decide', () => { t([null], undefined); t([null, 1], 1); t([null, null], undefined); t([null, null, 0], 0); });
  test('2ª ou 3ª empata → quem fez a 1ª', () => { t([0, null], 0); t([0, 1, null], 0); t([0, 1], undefined); t([0, 1, 1], 1); });
  test('tudo empatado → ninguém', () => { t([null, null, null], null); });
});

describe('carteador', () => {
  test('a primeira mão sorteia o carteador do rng; o mão é a cadeira à direita dele e abre', () => {
    for (const [r, dealer] of [[0, 0], [0.3, 1], [0.6, 2], [0.99, 3]] as const) {
      const g = createGame(); startHand(g, () => r);
      expect(g.dealer).toBe(dealer);
      expect(g.mao).toBe(nextSeat(dealer));
      expect(g.hand!.turn).toBe(g.mao);
      expect(g.hand!.leader).toBe(g.mao);
    }
  });

  test('nas mãos seguintes o carteador passa para a direita: o mão de uma mão dá a seguinte', () => {
    const g = createGame(); startHand(g, () => 0.3); // carteador 1, mão 2
    const seen: [Seat, Seat][] = [[g.dealer, g.mao]];
    for (let i = 0; i < 4; i++) { startHand(g, () => 0.99); seen.push([g.dealer, g.mao]); } // o rng não é mais consultado para isso
    expect(seen).toEqual([[1, 2], [2, 3], [3, 0], [0, 1], [1, 2]]);
    expect(g.handNo).toBe(5);
  });

  test('uma partida nova sorteia de novo; `dealer` fixa o carteador de qualquer mão', () => {
    const g = createGame(); startHand(g, () => 0.3); startHand(g, () => 0);
    expect(g.dealer).toBe(2);
    const g2 = createGame(); startHand(g2, () => 0);
    expect(g2.dealer).toBe(0);
    startHand(g2, () => 0, { dealer: 3 });
    expect(g2.dealer).toBe(3);
    expect(g2.mao).toBe(0);
  });

  test('quem corta é a cadeira à esquerda do carteador, e a ordem de dar começa no mão e termina no carteador', () => {
    expect([0, 1, 2, 3].map((d) => cutterOf(d as Seat))).toEqual([3, 0, 1, 2]);
    expect(dealOrder(0)).toEqual([0, 1, 2, 3]);
    expect(dealOrder(2)).toEqual([2, 3, 0, 1]);
    expect(dealOrder(3)).toEqual([3, 0, 1, 2]);
  });

  test('o evento newHand leva o mão, o carteador e quem corta', () => {
    const g = createGame(); startHand(g, () => 0.6); // carteador 2
    expect(takeEvents(g)[0]).toEqual({ type: 'newHand', mao: 3, dealer: 2, cutter: 1, special: 'normal', value: 2, decider: null });
  });

  test('as cartas saem uma por vez, do mão para a direita: do topo do baralho, a 1ª vai ao mão, a 4ª ao carteador, a 5ª ao mão de novo', () => {
    const deck = makeDeck(); // sem embaralhar: as últimas do baralho saem primeiro
    const top = [...deck].reverse();
    const g = createGame(); startHand(g, rng, { deck, dealer: 1 }); // mão 2
    expect(g.hand!.cards[2]).toEqual([top[0], top[4], top[8]]);
    expect(g.hand!.cards[3]).toEqual([top[1], top[5], top[9]]);
    expect(g.hand!.cards[0]).toEqual([top[2], top[6], top[10]]);
    expect(g.hand!.cards[1]).toEqual([top[3], top[7], top[11]]);
    expect(g.hand!.stock).toEqual(deck.slice(0, 28));
  });

  test('deckFor (o ajudante dos testes) entrega a cada cadeira as cartas pedidas seja quem for o mão, e o resto fica no monte', () => {
    const hands: CardId[][] = [['4c', '7h', 'As'], ['4d', '5d', '6d'], ['7d', '3c', '2c'], ['4h', '5h', '6h']];
    for (const mao of [0, 1, 2, 3] as Seat[]) {
      const g = createGame(); startHand(g, rng, { deck: deckFor(hands, mao, ['Kc', 'Qc']), dealer: ((mao + 3) % 4) as Seat });
      expect(g.mao).toBe(mao);
      expect(g.hand!.cards).toEqual(hands);
      expect(g.hand!.stock).toEqual(['Kc', 'Qc']);
    }
  });
});

describe('jogo', () => {
  test('deal: 3 cartas por cadeira, 28 no monte, mão joga primeiro', () => {
    const g = createGame(); startHand(g, Math.random, { dealer: 3 });
    expect(g.hand!.cards.every((c) => c.length === 3)).toBe(true);
    expect(g.hand!.stock.length).toBe(28);
    expect(g.hand!.turn).toBe(0);
  });

  test('kill / tie / lose são classificados ao cair na mesa', () => {
    const g = game([['5c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    expect(playCard(g, 0, '5c')).toBe(true);
    playCard(g, 1, 'Kc'); playCard(g, 2, 'Ks'); playCard(g, 3, '2c');
    const kinds = g.hand!.played[0].map((p) => p.kind);
    expect(kinds).toEqual(['lead', 'kill', 'tie', 'kill']);
    expect(g.hand!.results[0]).toBe(1);
    expect(g.hand!.turn).toBe(3); // quem matou sai na próxima
  });

  test('não pode jogar fora da vez nem carta que não tem', () => {
    const g = game([['5c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    expect(playCard(g, 1, 'Kc')).toBe(false);
    expect(playCard(g, 0, 'Kc')).toBe(false);
  });

  test('carta coberta só a partir da 2ª vaza e vale nada', () => {
    const g = game([['3c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    playCard(g, 0, '3c', true);
    expect(g.hand!.played[0][0].covered).toBe(false);
    playCard(g, 1, 'Kc'); playCard(g, 2, 'Ks'); playCard(g, 3, '2c'); // nós ganhamos a 1ª
    playCard(g, 0, '4d', true);
    expect(g.hand!.played[1][0].covered).toBe(true);
    expect(g.hand!.played[1][0].kind).toBe('cover');
  });

  test('escada do truco: pedir, aumentar, correr — pontos vão pra quem pediu por último', () => {
    const g = game([['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    expect(raise(g, 0)).toBe(true);           // truco (4)
    expect(g.hand!.phase).toBe('respond');
    expect(responderSeat(g)).toBe(1);
    expect(respond(g, 1, 'raise')).toBe(true); // seis
    expect(g.hand!.pending!.to).toBe(6);
    expect(respond(g, 0, 'raise')).toBe(true); // dez
    expect(respond(g, 1, 'decline')).toBe(true);
    expect(g.scores).toEqual([6, 0]);          // nós pedimos dez, eles correram do 6 aceito
    expect(g.hand!.phase).toBe('over');
  });

  test('quem acabou de aumentar não pede de novo (aumentos alternam)', () => {
    const g = game([['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']], { raiseOnlyOnTurn: false });
    raise(g, 0); respond(g, 1, 'accept');
    expect(g.hand!.value).toBe(4);
    expect(canRaise(g, 2)).toBe(false);       // nossa dupla acabou de pedir
    expect(canRaise(g, 1)).toBe(true);        // eles podem pedir seis
    raise(g, 1); respond(g, 2, 'accept');
    expect(canRaise(g, 3)).toBe(false);
    expect(canRaise(g, 0)).toBe(true);
  });

  test('mão de dez: correr entrega 2; jogar vale 4', () => {
    const g = game([['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']], {}, [10, 3]);
    expect(g.hand!.special).toBe('dez');
    expect(g.hand!.decider).toBe(0);
    expect(g.hand!.value).toBe(4);
    decideDez(g, 'run');
    expect(g.scores).toEqual([10, 5]);
  });

  test('mão de ferro aos 10 a 10 encerra o jogo', () => {
    const g = game([['4c', '7h', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']], {}, [10, 10]);
    expect(g.hand!.special).toBe('ferro');
    playCard(g, 0, '4c'); playCard(g, 1, 'Kc'); playCard(g, 2, 'Ks'); playCard(g, 3, '2c');
    expect(g.hand!.turn).toBe(0);            // o zap saiu de novo
    playCard(g, 0, '7h'); playCard(g, 1, '4s'); playCard(g, 2, '5h'); playCard(g, 3, '6c');
    expect(g.over).toBe(true);
  });

  test('coverFromTrick: 1 permite cobrir já na 1ª vaza', () => {
    const g = game([['3c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']], { coverFromTrick: 1 });
    playCard(g, 0, '3c', true);
    expect(g.hand!.played[0][0].covered).toBe(true);
    expect(g.hand!.played[0][0].kind).toBe('cover');
  });

  test('fim da vaza emite o evento trick com número, dupla vencedora e cadeira', () => {
    const g = game([['5c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    playCard(g, 0, '5c'); playCard(g, 1, 'Kc'); playCard(g, 2, 'Ks'); playCard(g, 3, '2c');
    const ev = takeEvents(g);
    expect(ev.map((e) => e.type)).toEqual(['newHand', 'play', 'play', 'play', 'play', 'trick']);
    expect(ev[5]).toEqual({ type: 'trick', n: 1, winner: 1, bestSeat: 3 });
  });

  test('eventos saem na fila e são drenados', () => {
    const g = game([['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    playCard(g, 0, '4c');
    const ev = takeEvents(g);
    expect(ev.map((e) => e.type)).toEqual(['newHand', 'play']);
    expect(g.events.length).toBe(0);
  });
});

describe('handUntouched: a mão ainda está sendo dada na tela', () => {
  const cards: CardId[][] = [['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']];
  test('vale logo depois de dar, e cai na primeira carta', () => {
    const g = game(cards);
    expect(handUntouched(g)).toBe(true);
    playCard(g, 0, '4c');
    expect(handUntouched(g)).toBe(false);
  });
  test('cai no truco pedido e continua caída depois de aceito', () => {
    const g = game(cards);
    raise(g, 0);
    expect(handUntouched(g)).toBe(false);
    respond(g, 1, 'accept');
    expect(handUntouched(g)).toBe(false);
  });
  test('na mão de dez vale enquanto a dupla decide, e cai ao decidir jogar', () => {
    const g = game(cards, {}, [10, 3]);
    expect(handUntouched(g)).toBe(true);
    decideDez(g, 'play');
    expect(handUntouched(g)).toBe(false);
  });
  test('sem mão, ou com a mão encerrada, não vale', () => {
    expect(handUntouched(createGame())).toBe(false);
    const g = game(cards, {}, [10, 3]);
    decideDez(g, 'run');
    expect(handUntouched(g)).toBe(false);
  });
});

describe('thinkTime: quanto um bot pensa', () => {
  test('jogar leva de 1 a 4 s, puxado para o começo; decidir leva de 2 a 4 s, parelho', () => {
    expect(thinkTime(() => 0, 'play')).toBe(1000);
    expect(thinkTime(() => 0.5, 'play')).toBe(1750);
    expect(thinkTime(() => 0.999, 'play')).toBeLessThan(4000);
    expect(thinkTime(() => 0, 'decision')).toBe(2000);
    expect(thinkTime(() => 0.5, 'decision')).toBe(3000);
    expect(thinkTime(() => 0.999, 'decision')).toBeLessThan(4000);
    let a = 7;
    const rng = () => { a = (a * 48271) % 2147483647; return a / 2147483647; };
    for (let i = 0; i < 200; i++) {
      const play = thinkTime(rng, 'play'), decision = thinkTime(rng, 'decision');
      expect(play).toBeGreaterThanOrEqual(1000); expect(play).toBeLessThan(4000);
      expect(decision).toBeGreaterThanOrEqual(2000); expect(decision).toBeLessThan(4000);
    }
  });
});
