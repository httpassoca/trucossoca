import { cardLabel, type GameEvent } from '@truco/rules';
import type { LogLine } from './state.svelte';
import type { TableSnapshot } from './table/table';

export const callName = (v: number) => ({ 4: 'TRUCO!', 6: 'SEIS!', 10: 'DEZ!', 12: 'DOZE!' } as Record<number, string>)[v] ?? `${v}!`;

/** Evento da mesa → linha do log, com os nomes de quem senta em cada cadeira e das duplas. */
export function formatEvent(e: GameEvent, snap: TableSnapshot): LogLine | null {
  const g = snap.game, h = g.hand;
  const names = snap.seats.map((s) => s.name), teams = snap.teams;
  const tag = `m${g.handNo}·v${h ? Math.min(h.played.length, 3) : 1}`;
  const line = (text: string): LogLine => ({ tag, text });
  switch (e.type) {
    case 'newHand':
      if (e.special === 'ferro') return line('Mão de ferro! 10 a 10 — todo mundo às cegas.');
      if (e.special === 'dez') return line(`Mão de dez para ${teams[e.decider!]}. Vale ${e.value}. ${names[e.mao]} é o mão.`);
      return line(`Nova mão. ${names[e.mao]} é o mão.`);
    case 'play': {
      const verb = e.kind === 'kill' ? 'matou com' : e.kind === 'tie' ? 'embuchou com' : 'jogou';
      return line(`${names[e.seat]} ${verb} ${e.covered || e.id === null ? 'carta coberta' : cardLabel(e.id)}`);
    }
    case 'raise': return line(`${names[e.seat]} pediu ${callName(e.to)} (${e.to})`);
    case 'respond':
      return e.action === 'accept'
        ? line(`${names[e.seat]} aceitou. Mão vale ${e.value}.`)
        : line(`${names[e.seat]} correu. ${teams[e.winnerTeam!]} leva ${e.value}.`);
    case 'dez': return line(e.action === 'play' ? `${teams[e.team]} joga a mão de dez.` : `${teams[e.team]} correu da mão de dez.`);
    case 'trick': return line(e.winner === null ? `Vaza ${e.n} empatou.` : `Vaza ${e.n}: ${teams[e.winner]} (${names[e.bestSeat!]}).`);
    case 'handEnd': return line(e.winner === null ? 'Ninguém pontua nesta mão.' : `${teams[e.winner]} faz ${e.points}. ${e.scores[0]} × ${e.scores[1]}.`);
    case 'gameOver': return line(`Fim de jogo! ${teams[e.winner]} ${g.scores[e.winner]} × ${g.scores[1 - e.winner]}.`);
  }
}
