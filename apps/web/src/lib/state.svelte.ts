import { defaultRules, type Rules, type Seat } from '@truco/rules';
import type { LogLine } from './format';
import { emptySnapshot, type Table, type TableSnapshot } from './table/table';

export type Prompt = { kind: 'respond' } | { kind: 'dez' } | { kind: 'over' } | null;

/** Estado de interface (o que não é regra do jogo). */
export const ui = $state({
  view: 0 as Seat,        // cadeira da câmera
  sel: 0,                 // índice da carta escolhida entre as cartas da cadeira atual
  menuOpen: true,
  locked: false,          // pointer lock ativo
  standing: false,        // espelho reativo da postura (camera.ts): a pessoa sentada se levantou
  nearSeat: false,        // de pé e perto da própria cadeira: Shift senta
  log: [] as LogLine[],
  rules: { ...defaultRules } as Rules, // offline: aplicadas na próxima mão
  bots: true,
  botDelay: 800,
});

/**
 * A mesa por trás da interface (ADR 0003): local ou remota, encaixada pela tela via `attachTable`.
 * `snap` é o espelho reativo do snapshot: trocado inteiro a cada mudança, nunca mutado.
 */
class Live {
  snap = $state.raw<TableSnapshot>(emptySnapshot());
  table: Table | null = null;
}
export const live = new Live();
