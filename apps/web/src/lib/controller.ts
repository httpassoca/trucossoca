import type { CardId, DezAction, GameEvent, RespondAction, Seat } from '@truco/rules';
import { callName, formatEvent, withHint } from './format';
import { hints, i18n, t } from './i18n.svelte';
import { resetLook, sitDown, spawnSeat, stance, standBehind } from './scene/camera';
import { resetLayout } from './scene/layout';
import { live, ui, type Prompt } from './state.svelte';
import type { Table, TableSnapshot } from './table/table';

/** Pontes para a cena 3D (registradas pelo World). */
export const bus = {
  say: (_seat: Seat, _text: string) => {},
  react: (_events: GameEvent[]) => {},
  lastPlay: { id: null as CardId | null, t: 0 },
};

/** Encaixa a mesa (local ou remota) atrás da interface; devolve como desencaixar. */
export function attachTable(table: Table, opts: { menuOpen: boolean }) {
  live.table = table;
  ui.menuOpen = opts.menuOpen;
  ui.log = [];
  resetLayout();
  live.snap = table.snapshot;
  // fantasma nasce de pé atrás de uma cadeira (cada fantasma novo atrás da seguinte); quem senta olha da própria
  sitDown();
  setView(table.snapshot.seat ?? spawnSeat(table.snapshot.ghosts.length));
  const off = table.subscribe(onTableChange);
  return () => { off(); if (live.table === table) live.table = null; };
}

/** Olhar da cadeira `s` (quem senta) ou ficar de pé atrás dela (fantasma). */
export function setView(s: Seat) { ui.view = s; ui.sel = 0; if (live.snap.seat === null) standBehind(s); else if (!stance.standing) resetLook(); }

/** A câmera anda solta: fantasma, ou pessoa sentada que se levantou. */
export const freeCamera = (snap: TableSnapshot) => snap.seat === null || stance.standing;
/** Tab troca de cadeira: fantasma (fica atrás da próxima) e mesa offline sem bots (a pessoa joga por todas). */
export const canCycleSeats = (snap: TableSnapshot) => snap.seat === null || (snap.restart === 'newGame' && !ui.bots);

/** É a vez desta pessoa jogar uma carta pela cadeira que está vendo. */
export function myTurn(snap: TableSnapshot, view: Seat) {
  const h = snap.game.hand;
  return !!h && h.phase === 'play' && snap.seat === view && h.turn === view;
}
export const mayRaise = (snap: TableSnapshot, view: Seat) => snap.seat === view && snap.canRaise;

/** O que a mesa pergunta a esta pessoa agora, derivado do snapshot. A um fantasma, nada: nem o fim de jogo (o placar já diz). */
export function promptOf(snap: TableSnapshot): Prompt {
  const h = snap.game.hand;
  if (snap.seat === null) return null;
  if (snap.game.over) return { kind: 'over' };
  if (!h || snap.acting !== snap.seat) return null;
  if (h.phase === 'respond') return { kind: 'respond' };
  if (h.phase === 'dezDecision') return { kind: 'dez' };
  return null;
}

export function promptAct(act: string) {
  const p = promptOf(live.snap); if (!p) return;
  if (p.kind === 'respond') live.table?.respond(act as RespondAction);
  else if (p.kind === 'dez') live.table?.decideDez(act as DezAction);
  else if (act === 'new') newGame();
}

export function newGame() { ui.log = []; live.table?.newGame(); }

/** Aplica cada mudança da mesa na interface: espelho, log, falas, câmera (sem bots a câmera segue quem age). */
export function onTableChange(snap: TableSnapshot, events: GameEvent[]) {
  const prev = live.snap;
  live.snap = snap;
  for (const e of events) {
    const line = formatEvent(e, snap);
    if (line) { ui.log.push(withHint(line, i18n.lang, hints)); if (ui.log.length > 60) ui.log.shift(); }
    if (e.type === 'raise') bus.say(e.seat, callName(e.to));
    if (e.type === 'respond') bus.say(e.seat, t(e.action === 'accept' ? 'say.accept' : 'say.decline'));
    if (e.type === 'play') bus.lastPlay = { id: e.id, t: performance.now() };
    if (e.type === 'newHand') ui.sel = 0;
  }
  if (events.length) bus.react(events);
  if (snap.seat !== null && snap.seat !== prev.seat) { sitDown(); setView(snap.seat); }
  const held = snap.game.hand?.cards[ui.view].length ?? 0;
  ui.sel = Math.max(0, Math.min(ui.sel, held - 1));
}
