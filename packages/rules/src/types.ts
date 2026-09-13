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

/** Uma carta segurada como este observador a vê: o id, ou null quando está oculta. */
export type CardSlot = CardId | null;

/** O que a mão tem em comum entre o estado do motor e a visão parcial que chega do servidor. */
export interface HandCore {
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

export interface HandState extends HandCore {
  /** cartas que cada cadeira segura */
  cards: CardId[][];
  stock: CardId[];
}

/** A mão como um observador a vê: cartas ocultas viram null e o monte vira só a contagem. */
export interface HandView extends HandCore {
  cards: CardSlot[][];
  stock: number;
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

export interface GameCore {
  rules: Rules;
  scores: [number, number];
  mao: Seat;
  handNo: number;
  over: boolean;
  winner: Team | null;
}

export interface GameState extends GameCore {
  hand: HandState | null;
  /** fila de eventos para a camada de apresentação drenar */
  events: GameEvent[];
}

/** A partida como um observador a vê (ver `viewFor`). É o que a interface e o snapshot da sala carregam. */
export interface GameView extends GameCore {
  hand: HandView | null;
}

/** O que os guardas do motor leem: serve tanto o estado inteiro quanto a visão parcial. */
export type GameReadable = GameCore & { hand: HandCore | null };

export type Rng = () => number;
