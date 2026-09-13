import { makeDeck, strength, teamOf, type CardId, type GameView, type HandView, type PlayView, type Seat } from '@truco/rules';
import * as THREE from 'three';
import { seatAngle, seatDir, seatRight, showFace, TABLE_TOP, type CardGroup } from './builders';
import { throwSpot, type Spot } from './throw';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), Y = new THREE.Vector3(0, 1, 0);
const DECK = makeDeck();

/** Posição de cada carta jogada é derivada da semente da jogada uma vez (quando aparece) e fica; a chave é a ordem na mão. */
const spots = new Map<string, Spot>();
let spotsHandKey = '';

function spotFor(g: GameView, p: PlayView, trick: PlayView[]): Spot {
  const key = `${g.handNo}:${p.order}`;
  let s = spots.get(key);
  if (!s) {
    // referência: a melhor carta que já estava na mesa antes desta
    let best = -1, ref: Spot | null = null;
    for (const q of trick) {
      if (q.order >= p.order) continue;
      const st = q.covered ? -1 : strength(q.id, g.rules);
      if (st > best) { best = st; ref = spots.get(`${g.handNo}:${q.order}`) ?? null; }
    }
    s = throwSpot(p.seat, p.kind, ref, p.seed);
    spots.set(key, s);
  }
  return s;
}

/**
 * Cartas que esta pessoa não vê (cartas alheias ocultas, a coberta de outra cadeira e o monte) são desenhadas com
 * as 40 cartas físicas que não aparecem em lugar nenhum do snapshot: costas são todas iguais. Cada vaga
 * (cadeira+índice, jogada coberta pela ordem, ou posição no monte) fica com a mesma carta física enquanto durar
 * a mão. Quando uma carta oculta é jogada, o seu id aparece na mesa: a carta física que o representava troca de
 * lugar com a que ocupava a vaga que sumiu, para a animação sair da mão de quem jogou; uma coberta sem id
 * herda a carta física de uma vaga que acabou de sumir, pelo mesmo motivo.
 */
class HiddenSlots {
  private bySlot = new Map<string, CardId>();
  private handKey = '';

  reset() { this.bySlot.clear(); this.handKey = ''; }

  assign(handKey: string, h: HandView, cards: Record<CardId, CardGroup>): Map<string, CardId> {
    if (handKey !== this.handKey) { this.bySlot.clear(); this.handKey = handKey; }
    const visible = new Set<CardId>();
    for (const held of h.cards) for (const id of held) if (id) visible.add(id);
    for (const trick of h.played) for (const p of trick) if (p.id) visible.add(p.id);
    const slots: string[] = [];
    h.cards.forEach((held, s) => held.forEach((id, i) => { if (!id) slots.push(`h${s}:${i}`); }));
    for (const trick of h.played) for (const p of trick) if (!p.id) slots.push(`p${p.order}`);
    for (let i = 0; i < h.stock; i++) slots.push(`k${i}`);
    const wanted = new Set(slots);

    const freed: CardId[] = [], orphaned: { slot: string; shown: CardId }[] = [];
    for (const [slot, id] of this.bySlot) {
      if (!wanted.has(slot)) { freed.push(id); this.bySlot.delete(slot); }
      else if (visible.has(id)) { orphaned.push({ slot, shown: id }); this.bySlot.delete(slot); }
    }
    for (const { slot, shown } of orphaned) {
      const swap = freed.shift(); if (!swap) break;
      swapPose(cards[shown], cards[swap]);
      this.bySlot.set(slot, swap);
    }
    const taken = new Set(this.bySlot.values());
    const spare = freed.filter((id) => !visible.has(id));
    const pool = [...spare, ...DECK.filter((id) => !visible.has(id) && !taken.has(id) && !spare.includes(id))];
    for (const slot of slots) if (!this.bySlot.has(slot)) { const id = pool.shift(); if (!id) break; this.bySlot.set(slot, id); }
    return this.bySlot;
  }
}
const hidden = new HiddenSlots();

/** Outra mesa (offline → online, ou o contrário) pode repetir o número da mão: esquece posições e vagas. */
export function resetLayout() { spots.clear(); spotsHandKey = ''; hidden.reset(); }

function swapPose(a: CardGroup, b: CardGroup) {
  const p = a.position.clone(), q = a.quaternion.clone(), br = a.userData.b;
  a.position.copy(b.position); a.quaternion.copy(b.quaternion); a.userData.b = b.userData.b;
  b.position.copy(p); b.quaternion.copy(q); b.userData.b = br;
}

function setTarget(card: CardGroup, seat: Seat, dist: number, lx: number, ly: number, lz: number, ex: number, ey: number) {
  card.userData.tp.copy(seatDir(seat).multiplyScalar(dist + lz)).addScaledVector(seatRight(seat), lx).setY(ly);
  card.userData.tq.setFromAxisAngle(Y, seatAngle(seat)).multiply(_q.setFromEuler(_e.set(ex, ey, 0, 'YXZ')));
}

/** `myTurn`: a pessoa joga pela cadeira vista agora (levanta a carta escolhida). */
export interface LayoutUi { view: Seat; sel: number; myTurn: boolean }

export function layoutCards(g: GameView, ui: LayoutUi, cards: Record<CardId, CardGroup>) {
  const h = g.hand; if (!h) return;
  const handKey = String(g.handNo);
  if (handKey !== spotsHandKey) { spots.clear(); spotsHandKey = handKey; }
  const slots = hidden.assign(handKey, h, cards);
  const blind = h.special === 'ferro' && g.rules.maoDeFerroBlind && h.phase !== 'over';
  for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
    const held = h.cards[s];
    const peek = h.revealPartner && teamOf(s) === h.decider && s === (ui.view + 2) % 4;
    held.forEach((slot, i) => {
      const id = slot ?? slots.get(`h${s}:${i}`); if (!id) return;
      showFace(cards[id], !!slot);
      const lx = (i - (held.length - 1) / 2) * 0.21;
      const lift = s === ui.view && ui.myTurn && i === ui.sel ? 0.045 : 0;
      cards[id].userData.tb = 1;
      if (blind) setTarget(cards[id], s, 0.8, lx, TABLE_TOP + 0.11 + lift, -lift * 0.6, Math.PI / 3, 0);
      else setTarget(cards[id], s, 0.8, lx, TABLE_TOP + 0.11 + lift, -lift * 0.6, -Math.PI / 3, peek ? Math.PI : 0);
    });
  }
  const last = h.played.length - 1;
  h.played.forEach((trick, t) => trick.forEach((p) => {
    const id = p.id ?? slots.get(`p${p.order}`); if (!id) return;
    const card = cards[id]; const sp = spotFor(g, p, trick);
    showFace(card, !!p.id);
    card.userData.tp.set(sp.x, TABLE_TOP + 0.002 + p.order * 0.0022, sp.z);
    card.userData.tq.setFromAxisAngle(Y, sp.yaw).multiply(_q.setFromEuler(_e.set(p.covered ? Math.PI / 2 : -Math.PI / 2, 0, 0, 'YXZ')));
    card.userData.tb = t === last ? 1 : 0.5;
  }));
  for (let i = 0; i < h.stock; i++) {
    const id = slots.get(`k${i}`); if (!id) break;
    const card = cards[id]; card.userData.tb = 1; showFace(card, false);
    card.userData.tp.set(0.62, TABLE_TOP + 0.002 + i * 0.0015, -0.62);
    card.userData.tq.setFromEuler(_e.set(Math.PI / 2, 0, 0.4, 'XYZ'));
  }
}
