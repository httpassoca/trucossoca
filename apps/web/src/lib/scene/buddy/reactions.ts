/**
 * Como os bonecos reagem ao jogo: uma tabela de evento → (cadeira, expressão, braços, quique, quanto tempo).
 * Quem age reage; a dupla comemora ou lamenta junto; os adversários se surpreendem. O World soma um atraso e
 * um tremor por boneco para as quatro caras não mudarem no mesmo quadro.
 */
import { teamOf, type GameEvent, type Seat, type Team } from '@truco/rules';
import type { ArmPoseName, ExpressionName } from './model';

export interface Reaction {
  seat: Seat;
  expression: ExpressionName;
  /** pose de braço enquanto a reação dura; volta para a pose de repouso depois */
  arms?: ArmPoseName;
  /** quica no assento (ou pula, de pé) */
  bounce?: boolean;
  /** quanto tempo a cara fica, em ms */
  hold: number;
}

const SEATS: Seat[] = [0, 1, 2, 3];
const ofTeam = (t: Team) => SEATS.filter((s) => teamOf(s) === t);
const partner = (s: Seat) => ((s + 2) % 4) as Seat;
const opponents = (s: Seat) => SEATS.filter((o) => teamOf(o) !== teamOf(s));

export function reactionsFor(e: GameEvent): Reaction[] {
  switch (e.type) {
    case 'raise':
      return [
        { seat: e.seat, expression: 'Smug', arms: 'Raise', hold: 2200 },
        { seat: partner(e.seat), expression: 'Smug', hold: 1800 },
        ...opponents(e.seat).map((seat): Reaction => ({ seat, expression: 'Surprised', hold: 1600 })),
      ];
    case 'respond':
      if (e.action === 'accept') return [
        { seat: e.seat, expression: 'Angry', hold: 2000 },
        { seat: partner(e.seat), expression: 'Proud', hold: 1600 },
      ];
      return [
        { seat: e.seat, expression: 'Sad', arms: 'Shrug', hold: 2200 },
        { seat: partner(e.seat), expression: 'Sad', hold: 1800 },
        ...opponents(e.seat).map((seat): Reaction => ({ seat, expression: 'Cheeky', hold: 1800 })),
      ];
    case 'trick':
      if (e.winner === null) return SEATS.map((seat): Reaction => ({ seat, expression: 'Surprised', hold: 1400 }));
      return [
        ...ofTeam(e.winner).map((seat): Reaction => ({ seat, expression: seat === e.bestSeat ? 'Proud' : 'Happy', hold: 1600 })),
        ...ofTeam((1 - e.winner) as Team).map((seat): Reaction => ({ seat, expression: 'Sad', hold: 1200 })),
      ];
    case 'handEnd':
      if (e.winner === null) return SEATS.map((seat): Reaction => ({ seat, expression: 'Calm', hold: 1600 }));
      return [
        ...ofTeam(e.winner).map((seat): Reaction => ({ seat, expression: 'Laughing', hold: 2200 })),
        ...ofTeam((1 - e.winner) as Team).map((seat): Reaction => ({ seat, expression: 'Sad', hold: 2000 })),
      ];
    case 'gameOver':
      return [
        ...ofTeam(e.winner).map((seat): Reaction => ({ seat, expression: 'Laughing', arms: 'Cheer', bounce: true, hold: 5000 })),
        ...ofTeam((1 - e.winner) as Team).map((seat): Reaction => ({ seat, expression: 'Sad', arms: 'Shrug', hold: 5000 })),
      ];
    case 'newHand':
      return SEATS.map((seat): Reaction => ({ seat, expression: 'Neutral', hold: 0 }));
    default:
      return [];
  }
}
