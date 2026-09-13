import type { Rules, Seat } from '@truco/rules';
import type { LogLine } from './format';
import { rememberedRules, rememberRules } from './identity';
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
  nearBotSeat: -1 as Seat | -1, // fantasma perto da cadeira de um bot: Shift senta no lugar dele (entre mãos)
  peek: false,            // segurando a tecla de olhar as cartas: elas sobem diante do rosto
  dealing: false,         // a coreografia de dar as cartas corre: as teclas de jogo esperam
  log: [] as LogLine[],
  rules: rememberedRules(), // as regras da pessoa: início, offline (aplicam na próxima mão) e a sala que ela abre
  bots: true,
  botPace: 1,             // ritmo dos bots offline: 0.5 rápido, 1 normal, 2 lento
});

/** Troca as regras da pessoa e deixa lembradas no navegador. */
export function setRules(rules: Rules) { ui.rules = rules; rememberRules(rules); }

/**
 * A mesa por trás da interface (ADR 0003): local ou remota, encaixada pela tela via `attachTable`.
 * `snap` é o espelho reativo do snapshot: trocado inteiro a cada mudança, nunca mutado.
 */
class Live {
  snap = $state.raw<TableSnapshot>(emptySnapshot());
  table: Table | null = null;
}
export const live = new Live();
