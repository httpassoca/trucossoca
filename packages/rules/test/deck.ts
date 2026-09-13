import { dealOrder, type CardId, type Seat } from '../src';

/**
 * Um baralho que dá a cada cadeira exatamente as três cartas pedidas em `hands[seat]`, na ordem em que as cartas
 * saem (uma por vez, do mão para a direita, `deck.pop()` a cada uma). `rest` é o que fica no monte, embaixo.
 */
export function deckFor(hands: CardId[][], mao: Seat, rest: CardId[] = []): CardId[] {
  const dealt: CardId[] = [];
  for (let i = 0; i < 3; i++) for (const s of dealOrder(mao)) dealt.push(hands[s][i]);
  return [...rest, ...dealt.reverse()];
}
