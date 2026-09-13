import { strength } from './cards';
import { canRaise, coverAllowed, currentBest, teamOf } from './engine';
import type { CardId, DezAction, GameState, RespondAction, Rng, Seat } from './types';

export type BotPlay = { kind: 'raise' } | { kind: 'play'; id: CardId; covered: boolean };

/** Bots só olham as próprias cartas — sem trapaça. Propositalmente simples. */
export function chooseBotPlay(g: GameState, seat: Seat, rng: Rng): BotPlay {
  const h = g.hand!, cards = h.cards[seat], plays = h.played[h.played.length - 1];
  const st = (id: CardId) => strength(id, g.rules);
  const sorted = [...cards].sort((a, b) => st(a) - st(b));
  if (canRaise(g, seat) && st(sorted[sorted.length - 1]) >= 10 && rng() < 0.3) return { kind: 'raise' };
  const { best, play } = currentBest(g);
  const partnerWinning = play !== null && teamOf(play.seat) === teamOf(seat);
  let pick: CardId;
  if (plays.length === 0) pick = sorted[rng() < 0.6 ? 0 : Math.floor(rng() * sorted.length)];
  else if (partnerWinning) pick = sorted[0];
  else pick = sorted.find((c) => st(c) > best) ?? sorted[0];
  const covered = coverAllowed(g) && partnerWinning && rng() < 0.5;
  return { kind: 'play', id: pick, covered };
}

export function chooseBotResponse(g: GameState, seat: Seat, rng: Rng): RespondAction {
  const h = g.hand!, p = h.pending!;
  const m = Math.max(0, ...h.cards[seat].map((id) => strength(id, g.rules)));
  const canReraise = p.toIdx + 1 < g.rules.ladder.length;
  if (m >= 12 && canReraise && rng() < 0.5) return 'raise';
  if (m >= 8 || rng() < 0.35) return 'accept';
  return 'decline';
}

export function chooseBotDez(g: GameState, rng: Rng): DezAction {
  const h = g.hand!;
  const seats: Seat[] = h.decider === 0 ? [0, 2] : [1, 3];
  const m = Math.max(...seats.flatMap((s) => h.cards[s].map((id) => strength(id, g.rules))));
  return m >= 9 || rng() < 0.4 ? 'play' : 'run';
}
