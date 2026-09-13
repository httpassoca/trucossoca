import { createGame, defaultRules, type GameState, type Rules, type Seat } from '@truco/rules';

export const NAMES = ['Você', 'Tião', 'Dita', 'Zé'] as const;
export const TEAMS = ['Nós', 'Eles'] as const;

export type Prompt = { kind: 'respond'; seat: Seat } | { kind: 'dez' } | { kind: 'over' } | null;
export interface LogLine { tag: string; text: string }

/** Estado de interface (o que não é regra do jogo). */
export const ui = $state({
  view: 0 as Seat,        // cadeira da câmera
  sel: 0,                 // carta escolhida na mão da cadeira atual
  coverNext: false,       // próxima carta vai coberta
  prompt: null as Prompt,
  menuOpen: true,
  locked: false,          // pointer lock ativo
  log: [] as LogLine[],
  rules: { ...defaultRules } as Rules, // aplicadas na próxima mão
  bots: true,
  botDelay: 800,
  tick: 0,                // incrementa a cada ação → a cena refaz o layout
});

/** Estado do jogo (regras puras em @truco/rules). Mutado só pelo controller. */
export const game = $state<GameState>(createGame(defaultRules));
