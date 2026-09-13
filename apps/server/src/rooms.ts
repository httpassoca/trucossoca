import { RoomHost } from './host';
import type { Log } from './log';
import { type RoomInit, type RoomPace } from './room';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;

/** As salas vivas do processo (ADR 0004: só memória). */
export class Rooms {
  private readonly rooms = new Map<string, RoomHost>();
  /** `pace`: ritmo dos bots e pausa entre mãos de toda sala nova (os testes apressam). */
  constructor(private readonly log: Log, private readonly random: () => number = Math.random, private readonly pace: Partial<RoomPace> = {}) {}

  get size() { return this.rooms.size; }
  get(code: string) { return this.rooms.get(code.toUpperCase()); }

  /** `init`: as regras e o cenário com que a sala nasce, se quem abriu pediu. */
  create(init: RoomInit = {}): RoomHost {
    let code: string;
    do { code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    const host = new RoomHost(code, this.log, (c) => { this.rooms.delete(c); this.log('room.removed', { room: c, rooms: this.rooms.size }); }, { pace: this.pace, init });
    this.rooms.set(code, host);
    return host;
  }
}
