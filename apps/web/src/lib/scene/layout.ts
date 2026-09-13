import { strength, teamOf, type CardId, type GameState, type Play, type Seat } from '@truco/rules';
import * as THREE from 'three';
import { humanControls } from '../controller';
import { seatAngle, seatDir, seatRight, TABLE_TOP, type CardGroup } from './builders';
import { throwSpot, type Spot } from './throw';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), Y = new THREE.Vector3(0, 1, 0);

/** Posição de cada carta jogada é sorteada uma vez (quando aparece) e fica. */
const spots = new Map<string, Spot>();
let spotsHandKey = '';

function spotFor(g: GameState, p: Play, round: Play[]): Spot {
  const key = `${g.handNo}:${p.id}`;
  let s = spots.get(key);
  if (!s) {
    // referência: a melhor carta que já estava na mesa antes desta
    let best = -1, ref: Spot | null = null;
    for (const q of round) {
      if (q.order >= p.order) continue;
      const st = q.covered ? -1 : strength(q.id, g.rules);
      if (st > best) { best = st; ref = spots.get(`${g.handNo}:${q.id}`) ?? null; }
    }
    s = throwSpot(p.seat, p.kind, ref);
    spots.set(key, s);
  }
  return s;
}

function setTarget(card: CardGroup, seat: Seat, dist: number, lx: number, ly: number, lz: number, ex: number, ey: number) {
  card.userData.tp.copy(seatDir(seat).multiplyScalar(dist + lz)).addScaledVector(seatRight(seat), lx).setY(ly);
  card.userData.tq.setFromAxisAngle(Y, seatAngle(seat)).multiply(_q.setFromEuler(_e.set(ex, ey, 0, 'YXZ')));
}

export interface LayoutUi { view: Seat; sel: number }

export function layoutCards(g: GameState, ui: LayoutUi, cards: Record<CardId, CardGroup>) {
  const h = g.hand; if (!h) return;
  const handKey = String(g.handNo);
  if (handKey !== spotsHandKey) { spots.clear(); spotsHandKey = handKey; }
  const blind = h.special === 'ferro' && g.rules.maoDeFerroBlind && h.phase !== 'over';
  const myTurn = h.phase === 'play' && humanControls(ui.view) && h.turn === ui.view;
  for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
    const hand = h.hands[s];
    const peek = h.revealPartner && teamOf(s) === h.decider && s === (ui.view + 2) % 4;
    hand.forEach((id, i) => {
      const lx = (i - (hand.length - 1) / 2) * 0.21;
      const lift = s === ui.view && myTurn && i === ui.sel ? 0.045 : 0;
      cards[id].userData.tb = 1;
      if (blind) setTarget(cards[id], s, 0.8, lx, TABLE_TOP + 0.11 + lift, -lift * 0.6, Math.PI / 3, 0);
      else setTarget(cards[id], s, 0.8, lx, TABLE_TOP + 0.11 + lift, -lift * 0.6, -Math.PI / 3, peek ? Math.PI : 0);
    });
  }
  const last = h.played.length - 1;
  h.played.forEach((round, r) => round.forEach((p) => {
    const card = cards[p.id]; const sp = spotFor(g, p, round);
    card.userData.tp.set(sp.x, TABLE_TOP + 0.002 + p.order * 0.0022, sp.z);
    card.userData.tq.setFromAxisAngle(Y, sp.yaw).multiply(_q.setFromEuler(_e.set(p.covered ? Math.PI / 2 : -Math.PI / 2, 0, 0, 'YXZ')));
    card.userData.tb = r === last ? 1 : 0.5;
  }));
  h.stock.forEach((id, i) => {
    const card = cards[id]; card.userData.tb = 1;
    card.userData.tp.set(0.62, TABLE_TOP + 0.002 + i * 0.0015, -0.62);
    card.userData.tq.setFromEuler(_e.set(Math.PI / 2, 0, 0.4, 'XYZ'));
  });
}
