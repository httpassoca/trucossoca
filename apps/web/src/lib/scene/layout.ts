import { makeDeck, strength, teamOf, type CardId, type GameView, type HandView, type PlayView, type Seat } from '@truco/rules';
import * as THREE from 'three';
import { monteSpot, seatAngle, seatDir, seatRight, showFace, TABLE_TOP, type CardGroup } from './builders';
import { DEAL_MS } from '@truco/protocol';
import { CAM_DIST, EYE_H } from './camera';
import { throwSpot, type Spot } from './throw';
import { DUR, moveTo, setPath, type Segment } from './tween';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), Y = new THREE.Vector3(0, 1, 0), _p = new THREE.Vector3(), _qq = new THREE.Quaternion();
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

/** Uma pose relativa à cadeira: `dist` para a frente (do centro da mesa para a cadeira), `lx` para a direita dela, `ly` de altura; ângulos em YXZ. */
function seatPose(seat: Seat, dist: number, lx: number, ly: number, ex: number, ey: number, ez: number, out: { p: THREE.Vector3; q: THREE.Quaternion }) {
  out.p.copy(seatDir(seat).multiplyScalar(dist)).addScaledVector(seatRight(seat), lx).setY(ly);
  out.q.setFromAxisAngle(Y, seatAngle(seat)).multiply(_q.setFromEuler(_e.set(ex, ey, ez, 'YXZ')));
  return out;
}
const _pose = { p: _p, q: _qq };

/**
 * Como uma cadeira segura as cartas: `rest` = na mão, baixas, junto à beira da mesa, viradas para baixo (ninguém lê);
 * `lift` = levantadas diante do rosto, em leque, com a face para os próprios olhos (a pessoa apertou para olhar; um bot,
 * enquanto pensa); `liftAway` = levantadas com a face para a mesa (a mão de ferro às cegas, e o parceiro mostrando as
 * cartas na mão de dez). `sel` sobe a carta escolhida um pouco.
 */
export type HandMode = 'rest' | 'lift' | 'liftAway';
export function handPose(seat: Seat, i: number, n: number, mode: HandMode, sel: boolean, out = _pose) {
  const c = i - (n - 1) / 2;
  if (mode === 'rest') return seatPose(seat, 1.12, c * 0.06, TABLE_TOP + 0.05 + i * 0.004 + (sel ? 0.02 : 0), 1.15, 0, c * 0.08, out);
  const away = mode === 'liftAway';
  return seatPose(seat, CAM_DIST - 0.30, c * 0.11, EYE_H - 0.22 - Math.abs(c) * 0.012 + (sel ? 0.03 : 0), -0.6, away ? Math.PI : 0, c * (away ? 0.15 : -0.15), out);
}

/** Uma carta do monte (ou de uma pilha): virada para baixo, empilhada, torta um pouco. */
function pilePose(at: THREE.Vector3, yaw: number, i: number, out = _pose) {
  out.p.set(at.x, TABLE_TOP + 0.002 + i * 0.0015, at.z);
  out.q.setFromAxisAngle(Y, yaw).multiply(_q.setFromEuler(_e.set(Math.PI / 2, 0, 0, 'YXZ')));
  return out;
}

/**
 * `myTurn`: a pessoa joga pela cadeira vista agora (sobe a carta escolhida). `lifted`: que cadeiras estão com as cartas levantadas.
 * `dealing`: a coreografia de dar as cartas ainda corre: nada de escolha nem de levantar, para não tirar uma carta do caminho dela.
 */
export interface LayoutUi { view: Seat; sel: number; myTurn: boolean; lifted: boolean[]; dealing: boolean }

export function layoutCards(g: GameView, ui: LayoutUi, cards: Record<CardId, CardGroup>) {
  const h = g.hand; if (!h) return;
  const handKey = String(g.handNo);
  if (handKey !== spotsHandKey) { spots.clear(); spotsHandKey = handKey; }
  const slots = hidden.assign(handKey, h, cards);
  const blind = h.special === 'ferro' && g.rules.maoDeFerroBlind && h.phase !== 'over';
  for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) {
    const held = h.cards[s];
    const peek = h.revealPartner && teamOf(s) === h.decider && s === (ui.view + 2) % 4;
    const mode: HandMode = ui.dealing ? 'rest' : peek ? 'liftAway' : ui.lifted[s] ? (blind ? 'liftAway' : 'lift') : 'rest';
    held.forEach((slot, i) => {
      const id = slot ?? slots.get(`h${s}:${i}`); if (!id) return;
      showFace(cards[id], !!slot);
      cards[id].userData.tb = 1;
      const sel = !ui.dealing && s === ui.view && ui.myTurn && i === ui.sel;
      const { p, q } = handPose(s, i, held.length, mode, sel);
      moveTo(cards[id], p, q, { dur: 260 });
    });
  }
  const last = h.played.length - 1;
  h.played.forEach((trick, t) => trick.forEach((p) => {
    const id = p.id ?? slots.get(`p${p.order}`); if (!id) return;
    const card = cards[id]; const sp = spotFor(g, p, trick);
    showFace(card, !!p.id);
    _p.set(sp.x, TABLE_TOP + 0.002 + p.order * 0.0022, sp.z);
    _qq.setFromAxisAngle(Y, sp.yaw).multiply(_q.setFromEuler(_e.set(p.covered ? Math.PI / 2 : -Math.PI / 2, 0, 0, 'YXZ')));
    moveTo(card, _p, _qq, { dur: DUR.throw, arc: 0.14 });
    card.userData.tb = t === last ? 1 : 0.5;
  }));
  const monte = monteSpot(g.mao), yaw = seatAngle(g.mao) + 0.4;
  for (let i = 0; i < h.stock; i++) {
    const id = slots.get(`k${i}`); if (!id) break;
    const card = cards[id]; card.userData.tb = 1; showFace(card, false);
    const { p, q } = pilePose(monte, yaw, i);
    moveTo(card, p, q, { dur: DUR.move });
  }
}

/** A ordem em que o carteador dá as cartas: começa pela mão (à sua direita) e segue para a direita. */
export const dealOrder = (mao: Seat): Seat[] => [0, 1, 2, 3].map((k) => ((mao + k) % 4) as Seat);

/** Quanto tempo a coreografia leva, do `newHand` até a última carta parar (ms): o `DEAL_MS` do protocolo, que segura os bots. */
export const DEAL_TOTAL = DEAL_MS;

/**
 * A coreografia de dar as cartas, a partir do `newHand`: as 40 cartas se juntam na frente do carteador, ele embaralha
 * (duas metades que se intercalam), passa o baralho a quem corta (à sua esquerda), o corte devolve uma parte ao carteador
 * e deixa a outra na frente da mão (que será o próximo carteador), o carteador dá uma carta por vez começando pela mão
 * e seguindo para a direita, e o que sobra vai para cima do monte. Cada carta física recebe o seu caminho no tempo;
 * o layout seguinte encontra os mesmos destinos e não mexe. Igual em toda tela, porque só depende do snapshot.
 */
export function choreographDeal(g: GameView, cards: Record<CardId, CardGroup>, now: number) {
  const h = g.hand; if (!h) return;
  const handKey = String(g.handNo);
  if (handKey !== spotsHandKey) { spots.clear(); spotsHandKey = handKey; }
  const slots = hidden.assign(handKey, h, cards);
  const dealer = g.dealer, mao = g.mao, cutter = ((dealer + 3) % 4) as Seat;
  const order = dealOrder(mao);
  const dealt: CardId[] = [];
  for (let k = 0; k < 12; k++) { const s = order[k % 4], i = Math.floor(k / 4); const id = h.cards[s][i] ?? slots.get(`h${s}:${i}`); if (id) dealt.push(id); }
  const stock: CardId[] = [];
  for (let i = 0; i < h.stock; i++) { const id = slots.get(`k${i}`); if (id) stock.push(id); }
  const parkedN = Math.max(0, stock.length - 6);
  const parked = stock.slice(0, parkedN), extra = stock.slice(parkedN);
  // pilha do carteador (de baixo para cima): as sobras, depois as que serão dadas (a de cima sai primeiro)
  const dealerPile = [...extra, ...dealt.slice().reverse()];
  const all = [...parked, ...dealerPile];
  const dealerAt = seatDir(dealer).multiplyScalar(0.82).addScaledVector(seatRight(dealer), -0.28), dealerYaw = seatAngle(dealer) + 0.2;
  const cutterAt = seatDir(cutter).multiplyScalar(0.82), cutterYaw = seatAngle(cutter) - 0.15;
  const monte = monteSpot(mao), monteYaw = seatAngle(mao) + 0.4;
  const seg = (pose: { p: THREE.Vector3; q: THREE.Quaternion }, t0: number, dur: number, arc = 0): Segment => ({ p: pose.p.clone(), q: pose.q.clone(), t0: now + t0, dur, arc });
  const paths = new Map<CardId, Segment[]>();
  all.forEach((id, i) => {
    const half = i % 2, side = half ? 0.13 : -0.13;
    const p: Segment[] = [
      seg(pilePose(dealerAt, dealerYaw, i), 0, 300),                                                          // juntar
      seg(pilePose(dealerAt.clone().addScaledVector(seatRight(dealer), side), dealerYaw + side, Math.floor(i / 2)), 350, 250, 0.05),   // duas metades
      seg(pilePose(dealerAt, dealerYaw, i), 650 + i * 8, 300, 0.06),                                           // intercalar
      seg(pilePose(cutterAt, cutterYaw, i), 1350, 400),                                                         // para quem corta
    ];
    paths.set(id, p);
  });
  parked.forEach((id, i) => paths.get(id)!.push(seg(pilePose(monte, monteYaw, i), 1850, 400, 0.04)));
  dealerPile.forEach((id, i) => paths.get(id)!.push(seg(pilePose(dealerAt, dealerYaw, i), 1850, 400, 0.08)));
  dealt.forEach((id, k) => {
    const s = order[k % 4], i = Math.floor(k / 4);
    paths.get(id)!.push(seg(handPose(s, i, 3, 'rest', false), 2350 + k * DUR.gap, DUR.deal, 0.10));
  });
  extra.forEach((id, i) => paths.get(id)!.push(seg(pilePose(monte, monteYaw, parkedN + i), 4250, 250, 0.05)));
  for (const [id, p] of paths) { setPath(cards[id], p); cards[id].userData.tb = 1; }
}
