export type Suit = 'c' | 'h' | 's' | 'd';
export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';
export type CardId = `${Rank}${Suit}`;
export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

/** Tudo configurável. Defaults = Truco Mineiro (Copag). */
export interface Rules {
  target: number;
  ladder: number[];
  fixedManilhas: boolean;
  useVira: boolean; // reservado (não usado no Mineiro)
  raiseOnlyOnTurn: boolean;
  alternateRaises: boolean;
  allowCovered: boolean;
  coverFromTrick: number;
  maoDeDezValue: number;
  maoDeDezPeek: boolean;
  maoDeFerroBlind: boolean;
  allTieNobody: boolean;
  tieLeader: 'mao' | 'leader';
}

/** Como a carta caiu na mesa — decide a animação/posição no cliente. */
export type PlayKind = 'lead' | 'kill' | 'tie' | 'lose' | 'cover';

export interface Play {
  seat: Seat;
  id: CardId;
  covered: boolean;
  kind: PlayKind;
  /** ordem global dentro da mão — quem joga depois fica por cima */
  order: number;
}

export interface Pending {
  by: Seat;
  team: Team;
  /** o que a dupla que pediu leva se o outro correr */
  from: number;
  to: number;
  toIdx: number;
}

export type Phase = 'play' | 'respond' | 'dezDecision' | 'over';
export type Special = 'normal' | 'dez' | 'ferro';

export interface HandState {
  /** cartas que cada cadeira segura */
  cards: CardId[][];
  stock: CardId[];
  played: Play[][];
  results: (Team | null)[];
  order: number;
  value: number;
  ladderIdx: number;
  pending: Pending | null;
  lastRaiseTeam: Team | null;
  turn: Seat;
  leader: Seat;
  special: Special;
  phase: Phase;
  decider: Team | null;
  revealPartner: boolean;
}

export type RespondAction = 'accept' | 'decline' | 'raise';
export type DezAction = 'play' | 'run';

export type GameEvent =
  | { type: 'newHand'; mao: Seat; special: Special; value: number; decider: Team | null }
  | { type: 'play'; seat: Seat; id: CardId; covered: boolean; kind: PlayKind }
  | { type: 'raise'; seat: Seat; to: number }
  | { type: 'respond'; seat: Seat; action: 'accept' | 'decline'; value: number; winnerTeam?: Team }
  | { type: 'dez'; team: Team; action: DezAction }
  | { type: 'trick'; n: number; winner: Team | null; bestSeat: Seat | null }
  | { type: 'handEnd'; winner: Team | null; points: number; scores: [number, number] }
  | { type: 'gameOver'; winner: Team };

export interface GameState {
  rules: Rules;
  scores: [number, number];
  mao: Seat;
  handNo: number;
  hand: HandState | null;
  over: boolean;
  winner: Team | null;
  /** fila de eventos para a camada de apresentação drenar */
  events: GameEvent[];
}

export type Rng = () => number;
