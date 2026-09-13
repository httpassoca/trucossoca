import { defaultRules, type Rules, type Seat } from '@truco/rules';
import { LocalTable } from './table/local';
import type { Table, TableSnapshot } from './table/table';

export const NAMES = ['Você', 'Tião', 'Dita', 'Zé'] as const;
export const TEAMS = ['Nós', 'Eles'] as const;

export type Prompt = { kind: 'respond' } | { kind: 'dez' } | { kind: 'over' } | null;
export interface LogLine { tag: string; text: string }

/** Estado de interface (o que não é regra do jogo). */
export const ui = $state({
  view: 0 as Seat,        // cadeira da câmera
  sel: 0,                 // índice da carta escolhida entre as cartas da cadeira atual
  menuOpen: true,
  locked: false,          // pointer lock ativo
  log: [] as LogLine[],
  rules: { ...defaultRules } as Rules, // aplicadas na próxima mão
  bots: true,
  botDelay: 800,
});

/**
 * A mesa por trás da interface (ADR 0003). Offline: motor e bots no navegador, lendo a configuração de `ui` ao vivo.
 * As regras saem do proxy do `$state` como objeto plano: o motor guarda e clona o que recebe.
 */
export const table: Table = new LocalTable({
  get rules() { return $state.snapshot(ui.rules); },
  get bots() { return ui.bots; },
  get botDelay() { return ui.botDelay; },
});

/** Espelho reativo do snapshot da mesa: trocado inteiro a cada mudança, nunca mutado. */
class Live { snap = $state.raw<TableSnapshot>(table.snapshot); }
export const live = new Live();
