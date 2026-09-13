import { cardLabel, type GameEvent, type GameState } from '@truco/rules';
import { NAMES, TEAMS, type LogLine } from './state.svelte';

export const callName = (v: number) => ({ 4: 'TRUCO!', 6: 'SEIS!', 10: 'DEZ!', 12: 'DOZE!' } as Record<number, string>)[v] ?? `${v}!`;

export function formatEvent(e: GameEvent, g: GameState): LogLine | null {
  const h = g.hand;
  const tag = `m${g.handNo}·r${h ? Math.min(h.played.length, 3) : 1}`;
  const line = (text: string): LogLine => ({ tag, text });
  switch (e.type) {
    case 'newHand':
      if (e.special === 'ferro') return line('Mão de ferro! 10 a 10 — todo mundo às cegas.');
      if (e.special === 'dez') return line(`Mão de dez para ${TEAMS[e.decider!]}. Vale ${e.value}. ${NAMES[e.mao]} é o mão.`);
      return line(`Nova mão. ${NAMES[e.mao]} é o mão.`);
    case 'play': {
      const verb = e.kind === 'kill' ? 'matou com' : e.kind === 'tie' ? 'embuchou com' : 'jogou';
      return line(`${NAMES[e.seat]} ${verb} ${e.covered ? 'carta coberta' : cardLabel(e.id)}`);
    }
    case 'raise': return line(`${NAMES[e.seat]} pediu ${callName(e.to)} (${e.to})`);
    case 'respond':
      return e.action === 'accept'
        ? line(`${NAMES[e.seat]} aceitou. Mão vale ${e.value}.`)
        : line(`${NAMES[e.seat]} correu. ${TEAMS[e.winnerTeam!]} leva ${e.value}.`);
    case 'dez': return line(e.action === 'play' ? `${TEAMS[e.team]} joga a mão de dez.` : `${TEAMS[e.team]} correu da mão de dez.`);
    case 'round': return line(e.winner === null ? `Rodada ${e.n} empatou.` : `Rodada ${e.n}: ${TEAMS[e.winner]} (${NAMES[e.bestSeat!]}).`);
    case 'handEnd': return line(e.winner === null ? 'Ninguém pontua nesta mão.' : `${TEAMS[e.winner]} faz ${e.points}. ${e.scores[0]} × ${e.scores[1]}.`);
    case 'gameOver': return line(e.winner === 0 ? 'Nós vencemos!' : 'Eles venceram.');
  }
}
