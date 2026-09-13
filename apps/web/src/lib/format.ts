import { cardLabel, type GameEvent } from '@truco/rules';
import { HINTS, translate, type HintBook, type HintKey, type Lang, type Msg, type Params } from './i18n';
import type { TableSnapshot } from './table/table';

/** A chamada de cada degrau da escada e a dica que a explica: fica em português nas duas línguas (spec #1, história 48). */
const CALLS: Record<number, { name: string; hint: HintKey }> = { 4: { name: 'TRUCO!', hint: 'truco' }, 6: { name: 'SEIS!', hint: 'seis' }, 10: { name: 'DEZ!', hint: 'dez' }, 12: { name: 'DOZE!', hint: 'doze' } };
export const callName = (v: number) => CALLS[v]?.name ?? `${v}!`;

/**
 * Uma linha do log: a mão e a vaza em que aconteceu, a frase por chave (rende na língua da hora, ver `renderLine`)
 * e, se for a primeira vez que esta chamada ou mão especial aparece para quem lê em inglês, a dica (`withHint`).
 */
export interface LogLine { hand: number; trick: number; msg: Msg; hint?: HintKey }

/** A linha que abre uma mão (o log põe um cabeçalho antes dela) e a que fecha uma vaza (o log põe um traço depois). */
export const opensHand = (l: LogLine) => l.msg.key === 'log.newHand' || l.msg.key === 'log.newHand.dealt' || l.msg.key === 'log.dezHand' || l.msg.key === 'log.ferroHand';
export const closesTrick = (l: LogLine) => l.msg.key === 'log.trick' || l.msg.key === 'log.trickTie';

/** O cabeçalho da mão que a linha abre, na língua da hora: número, valor e, quando se sabe, quem carteia. */
export function renderHandHead(lang: Lang, line: LogLine): string {
  const p = line.msg.params ?? {};
  const params = { hand: line.hand, value: p.value ?? '', dealer: p.dealer ?? '' };
  return translate(lang, p.dealer ? 'log.handHead.dealer' : 'log.handHead', params);
}

/** Evento da mesa → linha do log, com os nomes de quem senta em cada cadeira e das duplas. `hint` = a dica que este evento introduz, se alguma. */
export function formatEvent(e: GameEvent, snap: TableSnapshot): LogLine | null {
  const g = snap.game, h = g.hand;
  const names = snap.seats.map((s) => s.name), teams = snap.teams;
  const at = { hand: g.handNo, trick: h ? Math.min(h.played.length, 3) : 1 };
  const line = (msg: Msg, hint?: HintKey): LogLine => (hint ? { ...at, msg, hint } : { ...at, msg });
  switch (e.type) {
    case 'newHand': {
      // o valor e o carteador vão nos parâmetros de toda linha de mão nova: o log abre a mão com eles ("Mão 4 · vale 2 · carteia Zé")
      const dealer = e.dealer === undefined ? undefined : names[e.dealer];
      const head: Params = dealer ? { value: e.value, dealer } : { value: e.value };
      if (e.special === 'ferro') return line({ key: 'log.ferroHand', params: head }, 'ferroHand');
      if (e.special === 'dez') return line({ key: 'log.dezHand', params: { ...head, team: teams[e.decider!], name: names[e.mao] } }, 'dezHand');
      return line({ key: dealer ? 'log.newHand.dealt' : 'log.newHand', params: { ...head, name: names[e.mao] } });
    }
    case 'play': {
      // a coberta não tem força: nunca mata nem embucha
      if (e.covered || e.id === null) return line({ key: 'log.playCovered', params: { name: names[e.seat] } });
      const key = e.kind === 'kill' ? 'log.play.kill' : e.kind === 'tie' ? 'log.play.tie' : 'log.play';
      return line({ key, params: { name: names[e.seat], card: cardLabel(e.id) } });
    }
    case 'raise': return line({ key: 'log.raise', params: { name: names[e.seat], call: callName(e.to), to: e.to } }, CALLS[e.to]?.hint);
    case 'respond':
      return e.action === 'accept'
        ? line({ key: 'log.accept', params: { name: names[e.seat], value: e.value } })
        : line({ key: 'log.decline', params: { name: names[e.seat], team: teams[e.winnerTeam!], value: e.value } }, 'corro');
    case 'dez': return line({ key: e.action === 'play' ? 'log.dezPlay' : 'log.dezRun', params: { team: teams[e.team] } });
    case 'trick': return line(e.winner === null ? { key: 'log.trickTie', params: { n: e.n } } : { key: 'log.trick', params: { n: e.n, team: teams[e.winner], name: names[e.bestSeat!] } });
    case 'handEnd': return line(e.winner === null ? { key: 'log.handNobody' } : { key: 'log.handEnd', params: { team: teams[e.winner], points: e.points, a: e.scores[0], b: e.scores[1] } });
    case 'gameOver': return line({ key: 'log.gameOver', params: { team: teams[e.winner], a: g.scores[e.winner], b: g.scores[1 - e.winner] } });
  }
}

/** Mantém a dica só para quem lê em inglês e só na primeira vez; em português a chance fica guardada para depois. */
export function withHint(line: LogLine, lang: Lang, book: HintBook): LogLine {
  if (line.hint && lang === 'en' && book.claim(line.hint)) return line;
  const { hint: _, ...rest } = line;
  return rest;
}

/** A linha como a pessoa lê agora: etiqueta, frase e, lendo em inglês, a dica que a linha carrega. */
export function renderLine(lang: Lang, line: LogLine): { tag: string; text: string; hint?: string } {
  const out = { tag: translate(lang, 'log.tag', { hand: line.hand, trick: line.trick }), text: translate(lang, line.msg.key, line.msg.params) };
  return line.hint && lang === 'en' ? { ...out, hint: HINTS[line.hint] } : out;
}
