import type { Clock } from '../src/lib/table/clock';

/** Relógio manual: os timers viram uma fila que o teste esvazia na ordem em que venceriam. */
export class ManualClock implements Clock {
  now = 0;
  private seq = 0;
  private tasks: { id: number; at: number; fn: () => void }[] = [];
  setTimeout(fn: () => void, ms: number) { const id = ++this.seq; this.tasks.push({ id, at: this.now + ms, fn }); return id; }
  clearTimeout(handle: unknown) { this.tasks = this.tasks.filter((t) => t.id !== handle); }
  get pending() { return this.tasks.length; }
  /** roda o próximo timer a vencer */
  step() {
    this.tasks.sort((a, b) => a.at - b.at || a.id - b.id);
    const t = this.tasks.shift(); if (!t) return;
    this.now = t.at; t.fn();
  }
  /** roda até não sobrar timer nenhum */
  run(limit = 20_000) {
    while (this.tasks.length) {
      if (limit-- <= 0) throw new Error('a mesa não parou');
      this.step();
    }
  }
  /** roda tudo o que já venceu (as cadeias de timers de zero), sem avançar o relógio */
  settle() { while (this.tasks.some((t) => t.at <= this.now)) this.step(); }
  /** roda timer por timer até a condição valer (há timers que se repetem, como o ping: `run` não serve) */
  runUntil(done: () => boolean, limit = 20_000) {
    while (!done()) {
      if (!this.tasks.length) throw new Error('nada mais vai acontecer');
      if (limit-- <= 0) throw new Error('a condição nunca valeu');
      this.step();
    }
  }
}
