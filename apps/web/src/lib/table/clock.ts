/** Timers injetáveis (testes rodam sem esperar). */
export interface Clock { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }

export const realClock: Clock = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
