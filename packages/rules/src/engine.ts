import { makeDeck, shuffle, strength } from './cards';
import type {
  CardId, DezAction, GameReadable, GameState, GameView, HandState, Play, PlayKind, RespondAction, Rng, Rules, Seat, Team,
} from './types';

export const defaultRules: Rules = {
  target: 12,
  ladder: [2, 4, 6, 10, 12],
  fixedManilhas: true,
  useVira: false,
  raiseOnlyOnTurn: true,
  alternateRaises: true,
  allowCovered: true,
  coverFromTrick: 2,
  maoDeDezValue: 4,
  maoDeDezPeek: true,
  maoDeFerroBlind: true,
  allTieNobody: true,
  tieLeader: 'mao',
};

export const teamOf = (s: Seat): Team => (s % 2) as Team;
export const nextSeat = (s: Seat): Seat => ((s + 1) % 4) as Seat;
export const partnerOf = (s: Seat): Seat => ((s + 2) % 4) as Seat;

export function createGame(rules: Rules = defaultRules): GameState {
  return { rules: { ...rules }, scores: [0, 0], mao: 3, handNo: 0, hand: null, over: false, winner: null, events: [] };
}

/** Drena a fila de eventos (a apresentação chama depois de cada ação). */
export function takeEvents(g: GameState) {
  const ev = g.events; g.events = []; return ev;
}

/**
 * Começa uma mão nova. `deck` permite injetar o baralho (testes / servidor);
 * `rules` permite aplicar regras alteradas "na próxima mão".
 */
export function startHand(g: GameState, rng: Rng, opts: { deck?: CardId[]; rules?: Rules } = {}): HandState {
  if (opts.rules) g.rules = { ...opts.rules };
  const R = g.rules;
  g.mao = nextSeat(g.mao); g.handNo++;
  const deck = opts.deck ? [...opts.deck] : shuffle(makeDeck(), rng);
  const cards: CardId[][] = [[], [], [], []];
  for (let i = 0; i < 3; i++) for (let s = 0; s < 4; s++) cards[s].push(deck.pop()!);
  const h: HandState = {
    cards, stock: deck, played: [[]], results: [], order: 0,
    value: R.ladder[0], ladderIdx: 0, pending: null, lastRaiseTeam: null,
    turn: g.mao, leader: g.mao, special: 'normal', phase: 'play', decider: null, revealPartner: false,
  };
  const at10: [boolean, boolean] = [g.scores[0] === R.target - 2, g.scores[1] === R.target - 2];
  if (at10[0] && at10[1]) {
    h.special = 'ferro';
  } else if (at10[0] || at10[1]) {
    h.special = 'dez'; h.value = R.maoDeDezValue; h.decider = at10[0] ? 0 : 1; h.phase = 'dezDecision';
    h.revealPartner = R.maoDeDezPeek;
  }
  g.hand = h;
  g.events.push({ type: 'newHand', mao: g.mao, special: h.special, value: h.value, decider: h.decider });
  return h;
}

export function canRaise(g: GameReadable, seat: Seat): boolean {
  const h = g.hand, R = g.rules;
  if (!h || h.phase !== 'play' || h.pending || h.special !== 'normal') return false;
  if (R.raiseOnlyOnTurn && h.turn !== seat) return false;
  if (h.ladderIdx >= R.ladder.length - 1) return false;
  if (R.alternateRaises && h.lastRaiseTeam === teamOf(seat)) return false;
  return true;
}

export function raise(g: GameState, seat: Seat): boolean {
  const h = g.hand!; if (!canRaise(g, seat)) return false;
  const toIdx = h.ladderIdx + 1, to = g.rules.ladder[toIdx];
  h.pending = { by: seat, team: teamOf(seat), from: h.value, to, toIdx };
  h.phase = 'respond';
  g.events.push({ type: 'raise', seat, to });
  return true;
}

/** Quem responde ao pedido: alguém da outra dupla (cadeira seguinte a quem pediu). */
export function responderSeat(g: GameReadable): Seat {
  const p = g.hand!.pending!;
  return nextSeat(p.by);
}

export function respond(g: GameState, seat: Seat, action: RespondAction): boolean {
  const h = g.hand; if (!h || !h.pending || h.phase !== 'respond') return false;
  const p = h.pending;
  if (teamOf(seat) === p.team) return false;
  if (action === 'accept') {
    h.value = p.to; h.ladderIdx = p.toIdx; h.lastRaiseTeam = p.team; h.pending = null; h.phase = 'play';
    g.events.push({ type: 'respond', seat, action, value: h.value });
    return true;
  }
  if (action === 'decline') {
    g.events.push({ type: 'respond', seat, action, value: p.from, winnerTeam: p.team });
    endHand(g, p.team, p.from);
    return true;
  }
  // raise: aceita o valor pedido e pede o próximo degrau
  const toIdx = p.toIdx + 1;
  if (toIdx >= g.rules.ladder.length) return respond(g, seat, 'accept');
  const to = g.rules.ladder[toIdx];
  h.pending = { by: seat, team: teamOf(seat), from: p.to, to, toIdx };
  g.events.push({ type: 'raise', seat, to });
  return true;
}

export function decideDez(g: GameState, action: DezAction): boolean {
  const h = g.hand; if (!h || h.phase !== 'dezDecision') return false;
  h.revealPartner = false;
  g.events.push({ type: 'dez', team: h.decider!, action });
  if (action === 'play') { h.phase = 'play'; return true; }
  endHand(g, (1 - h.decider!) as Team, g.rules.ladder[0]);
  return true;
}

export function coverAllowed(g: GameReadable): boolean {
  const h = g.hand; if (!h) return false;
  return g.rules.allowCovered && h.special !== 'ferro' && h.played.length >= g.rules.coverFromTrick;
}

export function currentBest(g: GameReadable): { best: number; play: Play | null } {
  const h = g.hand!, plays = h.played[h.played.length - 1];
  let best = -1, play: Play | null = null;
  for (const p of plays) {
    const st = p.covered ? -1 : strength(p.id, g.rules);
    if (st > best) { best = st; play = p; }
  }
  return { best, play };
}

export function playCard(g: GameState, seat: Seat, id: CardId, covered = false): boolean {
  const h = g.hand; if (!h || h.phase !== 'play' || h.turn !== seat) return false;
  const cards = h.cards[seat]; const i = cards.indexOf(id); if (i < 0) return false;
  if (covered && !coverAllowed(g)) covered = false;
  const plays = h.played[h.played.length - 1];
  const { best } = currentBest(g);
  const st = covered ? -1 : strength(id, g.rules);
  const kind: PlayKind = covered ? 'cover' : plays.length === 0 ? 'lead' : st > best ? 'kill' : st === best ? 'tie' : 'lose';
  cards.splice(i, 1);
  plays.push({ seat, id, covered, kind, order: h.order++ });
  g.events.push({ type: 'play', seat, id, covered, kind });
  h.turn = nextSeat(seat);
  if (plays.length === 4) resolveTrick(g);
  return true;
}

function resolveTrick(g: GameState) {
  const h = g.hand!, R = g.rules, plays = h.played[h.played.length - 1];
  let best = -1, bestSeats: Seat[] = [];
  for (const p of plays) {
    const st = p.covered ? -1 : strength(p.id, R);
    if (st > best) { best = st; bestSeats = [p.seat]; } else if (st === best) bestSeats.push(p.seat);
  }
  const teams = new Set(bestSeats.map(teamOf));
  const winner: Team | null = teams.size === 1 ? [...teams][0] : null;
  h.results.push(winner);
  g.events.push({ type: 'trick', n: h.results.length, winner, bestSeat: winner === null ? null : bestSeats[0] });
  let hw = handWinner(h.results);
  if (hw === null && !R.allTieNobody) hw = teamOf(g.mao);
  if (hw !== undefined) { endHand(g, hw, h.value); return; }
  h.leader = winner !== null ? bestSeats[0] : R.tieLeader === 'mao' ? g.mao : h.leader;
  h.turn = h.leader;
  h.played.push([]);
}

/**
 * Regras de empate do Mineiro:
 * - empata a 1ª → a 2ª decide (se empatar também, a 3ª);
 * - empata a 2ª ou a 3ª → ganha quem fez a 1ª;
 * - empatam as três → ninguém (null).
 * `undefined` = a mão continua.
 */
export function handWinner(r: (Team | null)[]): Team | null | undefined {
  if (r[0] === null) {
    if (r.length >= 2 && r[1] !== null) return r[1];
    if (r.length === 3) return r[2];
    return undefined;
  }
  if (r.length >= 2) {
    if (r[1] === null || r[1] === r[0]) return r[0];
    if (r.length === 3) return r[2] === null ? r[0] : r[2];
  }
  return undefined;
}

function endHand(g: GameState, winner: Team | null, points: number) {
  const h = g.hand!; h.phase = 'over'; h.pending = null;
  if (winner !== null) g.scores[winner] += points;
  g.events.push({ type: 'handEnd', winner, points: winner === null ? 0 : points, scores: [...g.scores] as [number, number] });
  if (g.scores[0] >= g.rules.target || g.scores[1] >= g.rules.target) {
    g.over = true; g.winner = g.scores[0] >= g.rules.target ? 0 : 1;
    g.events.push({ type: 'gameOver', winner: g.winner });
  }
}

/** Quem precisa agir agora (-1 = ninguém: mão encerrada / decisão de mão de dez). */
export function actingSeat(g: GameReadable): Seat | -1 {
  const h = g.hand; if (!h || g.over) return -1;
  if (h.phase === 'respond') return responderSeat(g);
  if (h.phase === 'play') return h.turn;
  return -1;
}

/** De onde se olha a partida: uma cadeira (vê as próprias cartas e as do parceiro na decisão da mão de dez), tudo, ou nada. */
export type Perspective = Seat | 'all' | 'none';

/**
 * A partida vista de `from`: cópia sem a fila de eventos, cartas alheias ocultas e o monte só como contagem.
 * As cartas já jogadas ficam inteiras, cobertas inclusive: quando as jogadas forem online, a coberta precisa esconder o id.
 */
export function viewFor(g: GameState, from: Perspective): GameView {
  const { events: _events, hand, ...core } = structuredClone(g);
  if (!hand) return { ...core, hand: null };
  const { cards, stock, ...rest } = hand;
  const sees = (s: Seat) => {
    if (from === 'all') return true;
    if (from === 'none') return false;
    if (s === from) return true;
    return hand.revealPartner && s === partnerOf(from) && teamOf(from) === hand.decider;
  };
  return { ...core, hand: { ...rest, cards: cards.map((held, s) => (sees(s as Seat) ? held : held.map(() => null))), stock: stock.length } };
}
