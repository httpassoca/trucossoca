import { canCycleSeats, freeCamera, mayRaise, myTurn, promptAct, promptOf, setView } from './controller';
import { jump, look, MOVE_KEYS, nearSeat, sitDown, stance, standUp, walk, zoom } from './scene/camera';
import { live, ui } from './state.svelte';

let canvasEl: HTMLCanvasElement | null = null;
export const isLocked = () => !!canvasEl && document.pointerLockElement === canvasEl;
/** O mouse solto sobre a tela, em coordenadas normalizadas (-1..1): a cena mira a carta sob ele. */
export const pointer = { x: 0, y: 0, inside: false };

/** Quem senta quica na cadeira ao pular; pular de novo enquanto quica é levantar. */
export const bounce = { at: 0 };
const DOUBLE_JUMP = 450;

export function openMenu() { ui.menuOpen = true; walk.keys.clear(); zoom.on = false; ui.peek = false; }
export function resume() {
  ui.menuOpen = false;
  try { const r = canvasEl?.requestPointerLock(); (r as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* negado — a dica na barra pede um clique */ }
}

export function installPointerLock(canvas: HTMLCanvasElement) {
  canvasEl = canvas;
  const onMove = (e: MouseEvent) => {
    if (!isLocked()) {
      const r = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      pointer.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      return;
    }
    if (freeCamera(live.snap)) {
      // solta: gira livremente; o yaw fica em (-π, π] (o suavizado acompanha o salto, para não dar uma volta)
      const tyaw = look.tyaw - e.movementX * 0.0022, wrapped = Math.atan2(Math.sin(tyaw), Math.cos(tyaw));
      look.yaw += wrapped - tyaw; look.tyaw = wrapped;
      look.tpitch = Math.max(-1.4, Math.min(1.4, look.tpitch - e.movementY * 0.0022));
      return;
    }
    look.tyaw = Math.max(-1.35, Math.min(1.35, look.tyaw - e.movementX * 0.0022));
    look.tpitch = Math.max(-0.75, Math.min(0.6, look.tpitch - e.movementY * 0.0022));
  };
  const onChange = () => { ui.locked = isLocked(); ui.menuOpen = !ui.locked; if (!ui.locked) { walk.keys.clear(); zoom.on = false; ui.peek = false; } };
  const onBlur = () => { walk.keys.clear(); zoom.on = false; ui.peek = false; pointer.inside = false; };
  const onError = () => { ui.locked = false; };
  const onClick = () => { if (!isLocked()) resume(); };
  // botão direito: zoom enquanto segura (só sentado; de pé ou fantasma não há para onde se inclinar)
  const onDown = (e: MouseEvent) => { if (e.button === 2 && isLocked() && !freeCamera(live.snap)) zoom.on = true; };
  const onUp = (e: MouseEvent) => { if (e.button === 2) zoom.on = false; };
  const onContext = (e: Event) => e.preventDefault();
  document.addEventListener('mousemove', onMove);
  document.addEventListener('pointerlockchange', onChange);
  document.addEventListener('pointerlockerror', onError);
  document.addEventListener('mousedown', onDown);
  document.addEventListener('mouseup', onUp);
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('contextmenu', onContext);
  window.addEventListener('blur', onBlur);
  return () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('pointerlockchange', onChange);
    document.removeEventListener('pointerlockerror', onError);
    document.removeEventListener('mousedown', onDown);
    document.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('click', onClick);
    canvas.removeEventListener('contextmenu', onContext);
    window.removeEventListener('blur', onBlur);
  };
}

/** A tecla de olhar as cartas: segura para levantar, solta para baixar. Só sentado; de pé as cartas ficam na mesa. */
export const PEEK_KEY = 'Shift';

/** Soltar uma tecla de andar, ou a de olhar as cartas. */
export function onKeyUp(e: KeyboardEvent) { walk.keys.delete(e.code); if (e.key === PEEK_KEY) ui.peek = false; }

/** Espaço: fantasma ou de pé pula; sentado quica, e quicando de novo levanta. */
function onSpace(seat: number | null) {
  if (seat === null || stance.standing) { jump(); return; }
  const now = performance.now();
  if (now - bounce.at < DOUBLE_JUMP) { bounce.at = 0; standUp(seat as 0 | 1 | 2 | 3); return; }
  bounce.at = now;
}

export function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isLocked()) return; // o navegador solta o lock; pointerlockchange abre o menu
    if (ui.menuOpen) resume(); else openMenu();
    return;
  }
  if (ui.menuOpen) { if (e.key === 'Enter') resume(); return; }
  const table = live.table, snap = live.snap, h = snap.game.hand; if (!table) return;
  // Tab: fantasma fica de pé atrás da próxima cadeira; offline sem bots, a pessoa olha da próxima
  if (e.key === 'Tab') { e.preventDefault(); if (canCycleSeats(snap)) setView(((ui.view + 1) % 4) as 0 | 1 | 2 | 3); return; }
  if (e.key === ' ') { e.preventDefault(); if (!e.repeat) onSpace(snap.seat); return; }
  if (freeCamera(snap)) {
    if (MOVE_KEYS.has(e.code)) { e.preventDefault(); walk.keys.add(e.code); }
    // Shift perto da própria cadeira: senta de novo; fantasma perto da cadeira de um bot: senta no lugar dele (entre mãos, ou fica na intenção)
    if (e.key === 'Shift' && snap.seat !== null && stance.standing && nearSeat(snap.seat)) { sitDown(); return; }
    if (e.key === 'Shift' && snap.seat === null && ui.nearBotSeat !== -1) { table.takeBotSeat(ui.nearBotSeat); return; }
    if (snap.seat === null) return; // fantasma: nenhuma tecla de jogo
  }
  if (!h) return;
  // segurar a tecla de olhar levanta as cartas (sentado); repetição de tecla não conta
  if (e.key === PEEK_KEY && !stance.standing) { if (!e.repeat && !ui.dealing) ui.peek = true; return; }
  if (ui.dealing) return; // as cartas ainda estão sendo dadas
  const p = promptOf(snap);
  if (p) {
    if (e.key === 'Enter') promptAct(p.kind === 'respond' ? 'accept' : p.kind === 'dez' ? 'play' : 'new');
    else if (e.key === 'x' || e.key === 'X') promptAct(p.kind === 'respond' ? 'decline' : 'run');
    else if (e.key === 'r' || e.key === 'R') promptAct('raise');
    return;
  }
  const cards = h.cards[ui.view];
  if (e.key === 'ArrowLeft' && !stance.standing) { ui.sel = Math.max(0, ui.sel - 1); return; }
  if (e.key === 'ArrowRight' && !stance.standing) { ui.sel = Math.min(cards.length - 1, ui.sel + 1); return; }
  if (e.key === 'c' || e.key === 'C') { table.toggleCover(); return; }
  if (e.key === 't' || e.key === 'T') { if (mayRaise(snap, ui.view)) table.raise(); return; }
  if (!myTurn(snap, ui.view)) return;
  const pick = (i: number) => { const id = cards[i]; if (id) table.play(id); };
  if (e.key === 'Enter') { e.preventDefault(); pick(ui.sel); return; }
  const n = parseInt(e.key); if (n >= 1 && n <= 3) pick(n - 1);
}
