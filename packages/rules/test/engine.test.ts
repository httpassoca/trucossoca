import { describe, expect, test } from 'bun:test';
import {
  createGame, defaultRules, handWinner, canRaise, playCard, raise, respond, responderSeat, startHand, strength,
  decideDez, takeEvents, type CardId, type Rules, type Team,
} from '../src';

const R = defaultRules;
const rng = () => 0.5;
/** baralho onde os últimos 12 são as mãos (deal faz pop): seat s recebe deck[-1-s], deck[-5-s], deck[-9-s] */
function deckFor(hands: CardId[][]): CardId[] {
  const dealt: CardId[] = [];
  for (let i = 0; i < 3; i++) for (let s = 0; s < 4; s++) dealt.push(hands[s][i]);
  return [...dealt].reverse();
}
function game(hands: CardId[][], rules: Partial<Rules> = {}, scores: [number, number] = [0, 0]) {
  const g = createGame({ ...R, ...rules }); g.scores = scores;
  startHand(g, rng, { deck: deckFor(hands) }); // mão = seat 0
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
  test('duas rodadas seguidas', () => { t([0, 0], 0); t([1, 1], 1); });
  test('1ª empata → 2ª decide', () => { t([null], undefined); t([null, 1], 1); t([null, null], undefined); t([null, null, 0], 0); });
  test('2ª ou 3ª empata → quem fez a 1ª', () => { t([0, null], 0); t([0, 1, null], 0); t([0, 1], undefined); t([0, 1, 1], 1); });
  test('tudo empatado → ninguém', () => { t([null, null, null], null); });
});

describe('jogo', () => {
  test('deal: 3 cartas por cadeira, 28 no monte, mão joga primeiro', () => {
    const g = createGame(); startHand(g, Math.random);
    expect(g.hand!.hands.every((h) => h.length === 3)).toBe(true);
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

  test('carta coberta só a partir da 2ª rodada e vale nada', () => {
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

  test('eventos saem na fila e são drenados', () => {
    const g = game([['4c', '4d', '4h'], ['Kc', '4s', '5d'], ['Ks', '5h', '5s'], ['2c', '6c', '6d']]);
    playCard(g, 0, '4c');
    const ev = takeEvents(g);
    expect(ev.map((e) => e.type)).toEqual(['newHand', 'play']);
    expect(g.events.length).toBe(0);
  });
});
