import {
  actingSeat as engineActing, canRaise, chooseBotDez, chooseBotPlay, chooseBotResponse, createGame, decideDez,
  playCard, raise, respond, responderSeat, startHand, takeEvents,
  type CardId, type DezAction, type RespondAction, type Seat, type Team,
} from '@truco/rules';
import { callName, formatEvent } from './format';
import { game, ui } from './state.svelte';

/** Pontes para a cena 3D (registradas pelo World). */
export const bus = {
  say: (_seat: Seat, _text: string) => {},
  resetLook: () => {},
  lastPlay: { id: null as CardId | null, t: 0 },
};

const rng = Math.random;
let timer: ReturnType<typeof setTimeout> | undefined;

export const humanControls = (s: Seat) => !ui.bots || s === 0;

/** Quem responde ao truco: se a dupla desafiada tem humano, o humano responde. */
export function responder(): Seat {
  const p = game.hand!.pending!;
  const team = (1 - p.team) as Team;
  if (ui.bots && team === 0) return 0;
  return responderSeat(game);
}
export const actingSeat = () => engineActing(game);

export function newGame() {
  clearTimeout(timer);
  Object.assign(game, createGame(ui.rules));
  ui.prompt = null; ui.log = [];
  newHand();
}
export function newHand() {
  clearTimeout(timer);
  startHand(game, rng, { rules: ui.rules });
  ui.sel = 0; ui.coverNext = false;
  afterAction();
}
export function setView(s: Seat) { ui.view = s; ui.sel = 0; bus.resetLook(); ui.tick++; }

export function doPlay(seat: Seat, id: CardId, covered: boolean) {
  if (!playCard(game, seat, id, covered)) return;
  if (seat === ui.view) { ui.sel = Math.max(0, Math.min(ui.sel, game.hand!.cards[seat].length - 1)); ui.coverNext = false; }
  afterAction();
}
export function doRaise(seat: Seat) { if (raise(game, seat)) afterAction(); }
export function doRespond(seat: Seat, action: RespondAction) { ui.prompt = null; if (respond(game, seat, action)) afterAction(); }
export function doDez(action: DezAction) { ui.prompt = null; if (decideDez(game, action)) afterAction(); }
export const canHumanRaise = () => humanControls(ui.view) && canRaise(game, ui.view);

export function promptAct(act: string) {
  const p = ui.prompt; if (!p) return;
  if (p.kind === 'respond') doRespond(p.seat, act as RespondAction);
  else if (p.kind === 'dez') doDez(act as DezAction);
  else if (p.kind === 'over' && act === 'new') newGame();
}

function afterAction() { drain(); ui.tick++; schedule(); }

function drain() {
  for (const e of takeEvents(game)) {
    const line = formatEvent(e, game);
    if (line) { ui.log.push(line); if (ui.log.length > 60) ui.log.shift(); }
    if (e.type === 'raise') bus.say(e.seat, callName(e.to));
    if (e.type === 'respond') bus.say(e.seat, e.action === 'accept' ? 'Aceito.' : 'Corro!');
    if (e.type === 'play') bus.lastPlay = { id: e.id, t: performance.now() };
    if (e.type === 'gameOver') ui.prompt = { kind: 'over' };
    if (e.type === 'handEnd' && !game.over) timer = setTimeout(newHand, 2200);
  }
}

/** Quem age agora: humano espera o teclado, bot age depois de um delay. */
export function schedule() {
  const h = game.hand; if (!h || game.over || h.phase === 'over') return;
  clearTimeout(timer);
  if (h.phase === 'dezDecision') {
    if (h.decider === 0 || !ui.bots) { if (!ui.bots) setView(h.decider === 0 ? 0 : 1); ui.prompt = { kind: 'dez' }; }
    else timer = setTimeout(() => doDez(chooseBotDez(game, rng)), ui.botDelay + 300);
    return;
  }
  if (h.phase === 'respond') {
    const r = responder();
    if (humanControls(r)) { if (!ui.bots) setView(r); ui.prompt = { kind: 'respond', seat: r }; }
    else timer = setTimeout(() => doRespond(r, chooseBotResponse(game, r, rng)), ui.botDelay + 300);
    return;
  }
  if (!humanControls(h.turn)) {
    timer = setTimeout(() => {
      const hh = game.hand; if (!hh || hh.phase !== 'play') return;
      const c = chooseBotPlay(game, hh.turn, rng);
      if (c.kind === 'raise') doRaise(hh.turn); else doPlay(hh.turn, c.id, c.covered);
    }, ui.botDelay);
  } else if (!ui.bots && ui.view !== h.turn) setView(h.turn);
}
