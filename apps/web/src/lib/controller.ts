import type { CardId, DezAction, GameEvent, RespondAction, Seat } from '@truco/rules';
import { callName, formatEvent } from './format';
import { resetLook } from './scene/camera';
import { resetLayout } from './scene/layout';
import { live, ui, type Prompt } from './state.svelte';
import type { Table, TableSnapshot } from './table/table';

/** Pontes para a cena 3D (registradas pelo World). */
export const bus = {
  say: (_seat: Seat, _text: string) => {},
  lastPlay: { id: null as CardId | null, t: 0 },
};

/** Encaixa a mesa (local ou remota) atrás da interface; devolve como desencaixar. */
export function attachTable(table: Table, opts: { menuOpen: boolean }) {
  live.table = table;
  ui.menuOpen = opts.menuOpen;
  ui.log = [];
  resetLayout();
  live.snap = table.snapshot;
  setView(table.snapshot.seat ?? 0);
  const off = table.subscribe(onTableChange);
  return () => { off(); if (live.table === table) live.table = null; };
}

export function setView(s: Seat) { ui.view = s; ui.sel = 0; resetLook(); }

/** É a vez desta pessoa jogar uma carta pela cadeira que está vendo. */
export function myTurn(snap: TableSnapshot, view: Seat) {
  const h = snap.game.hand;
  return !!h && h.phase === 'play' && snap.seat === view && h.turn === view;
}
export const mayRaise = (snap: TableSnapshot, view: Seat) => snap.seat === view && snap.canRaise;

/** O que a mesa pergunta a esta pessoa agora, derivado do snapshot. */
export function promptOf(snap: TableSnapshot): Prompt {
  const h = snap.game.hand;
  if (snap.game.over) return { kind: 'over' };
  if (!h || snap.seat === null || snap.acting !== snap.seat) return null;
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
    if (line) { ui.log.push(line); if (ui.log.length > 60) ui.log.shift(); }
    if (e.type === 'raise') bus.say(e.seat, callName(e.to));
    if (e.type === 'respond') bus.say(e.seat, e.action === 'accept' ? 'Aceito.' : 'Corro!');
    if (e.type === 'play') bus.lastPlay = { id: e.id, t: performance.now() };
    if (e.type === 'newHand') ui.sel = 0;
  }
  if (snap.seat !== null && snap.seat !== prev.seat) setView(snap.seat);
  const held = snap.game.hand?.cards[ui.view].length ?? 0;
  ui.sel = Math.max(0, Math.min(ui.sel, held - 1));
}
