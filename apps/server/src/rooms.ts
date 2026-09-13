import { RoomHost } from './host';
import type { Log } from './log';
import { DEFAULT_PACE, type RoomPace } from './room';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

/** As salas vivas do processo (ADR 0004: só memória). */
export class Rooms {
  private readonly rooms = new Map<string, RoomHost>();
  /** `pace`: ritmo dos bots e pausa entre mãos de toda sala nova (os testes apressam). */
  constructor(private readonly log: Log, private readonly random: () => number = Math.random, private readonly pace: RoomPace = DEFAULT_PACE) {}

  get size() { return this.rooms.size; }
  get(code: string) { return this.rooms.get(code.toUpperCase()); }

  create(): RoomHost {
    let code: string;
    do { code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    const host = new RoomHost(code, this.log, (c) => { this.rooms.delete(c); this.log('room.removed', { room: c, rooms: this.rooms.size }); }, Date.now(), this.pace);
    this.rooms.set(code, host);
    return host;
  }
}
