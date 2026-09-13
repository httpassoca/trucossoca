import type { CardId, Rank, Rng, Rules, Suit } from './types';

export const RANKS: Rank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
export const SUITS: Record<Suit, string> = { c: '♣', h: '♥', s: '♠', d: '♦' };
/** Manilhas fixas do Mineiro: zap > sete de copas > espadilha > sete de ouros */
export const MANILHA: Partial<Record<CardId, number>> = { '4c': 14, '7h': 13, As: 12, '7d': 11 };

export const rankOf = (id: CardId) => id[0] as Rank;
export const suitOf = (id: CardId) => id[1] as Suit;
export const cardLabel = (id: CardId) => rankOf(id) + SUITS[suitOf(id)];

export function strength(id: CardId, rules: Pick<Rules, 'fixedManilhas'>): number {
  if (rules.fixedManilhas && MANILHA[id]) return MANILHA[id]!;
  return RANKS.indexOf(rankOf(id)) + 1;
}

export function makeDeck(): CardId[] {
  const d: CardId[] = [];
  for (const s of Object.keys(SUITS) as Suit[]) for (const r of RANKS) d.push(`${r}${s}`);
  return d;
}

export function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
