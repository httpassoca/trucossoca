import { mayRaise, myTurn, promptAct, promptOf, setView } from './controller';
import { look } from './scene/camera';
import { live, ui } from './state.svelte';

let canvasEl: HTMLCanvasElement | null = null;
export const isLocked = () => !!canvasEl && document.pointerLockElement === canvasEl;

export function openMenu() { ui.menuOpen = true; }
export function resume() {
  ui.menuOpen = false;
  try { const r = canvasEl?.requestPointerLock(); (r as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* negado — a dica na barra pede um clique */ }
}

export function installPointerLock(canvas: HTMLCanvasElement) {
  canvasEl = canvas;
  const onMove = (e: MouseEvent) => {
    if (!isLocked()) return;
    look.tyaw = Math.max(-1.35, Math.min(1.35, look.tyaw - e.movementX * 0.0022));
    look.tpitch = Math.max(-0.75, Math.min(0.6, look.tpitch - e.movementY * 0.0022));
  };
  const onChange = () => { ui.locked = isLocked(); ui.menuOpen = !ui.locked; };
  const onError = () => { ui.locked = false; };
  const onClick = () => { if (!isLocked()) resume(); };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('pointerlockchange', onChange);
  document.addEventListener('pointerlockerror', onError);
  canvas.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('pointerlockchange', onChange);
    document.removeEventListener('pointerlockerror', onError);
    canvas.removeEventListener('click', onClick);
  };
}

export function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isLocked()) return; // o navegador solta o lock; pointerlockchange abre o menu
    if (ui.menuOpen) resume(); else openMenu();
    return;
  }
  if (ui.menuOpen) { if (e.key === 'Enter') resume(); return; }
  const table = live.table, snap = live.snap, h = snap.game.hand; if (!table || !h) return;
  if (e.key === 'Tab') { e.preventDefault(); setView(((ui.view + 1) % 4) as 0 | 1 | 2 | 3); return; }
  const p = promptOf(snap);
  if (p) {
    if (e.key === 'Enter' || e.key === ' ') promptAct(p.kind === 'respond' ? 'accept' : p.kind === 'dez' ? 'play' : 'new');
    else if (e.key === 'x' || e.key === 'X') promptAct(p.kind === 'respond' ? 'decline' : 'run');
    else if (e.key === 'r' || e.key === 'R') promptAct('raise');
    return;
  }
  const cards = h.cards[ui.view];
  if (e.key === 'ArrowLeft') { ui.sel = Math.max(0, ui.sel - 1); return; }
  if (e.key === 'ArrowRight') { ui.sel = Math.min(cards.length - 1, ui.sel + 1); return; }
  if (e.key === 'c' || e.key === 'C') { table.toggleCover(); return; }
  if (e.key === 't' || e.key === 'T') { if (mayRaise(snap, ui.view)) table.raise(); return; }
  if (!myTurn(snap, ui.view)) return;
  const pick = (i: number) => { const id = cards[i]; if (id) table.play(id); };
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(ui.sel); return; }
  const n = parseInt(e.key); if (n >= 1 && n <= 3) pick(n - 1);
}
