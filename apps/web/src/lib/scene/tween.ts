import * as THREE from 'three';
import type { CardGroup } from './builders';

/**
 * Movimento das cartas no tempo. Cada carta tem um caminho: trechos em sequência, cada um com destino, quando começa
 * (ms, relógio de `performance.now`), quanto dura e a altura do arco. Um trecho parte de onde a carta estiver quando
 * chegar a sua hora. Sem caminho, a carta fica parada onde está (que é o destino `tp`/`tq`).
 */
export interface Segment {
  p: THREE.Vector3; q: THREE.Quaternion;
  /** quando o trecho começa (ms) */
  t0: number;
  /** duração (ms) */
  dur: number;
  /** altura do arco no meio do caminho (m); 0 = reta */
  arc: number;
  /** de onde partiu; anotado quando o trecho começa */
  from?: { p: THREE.Vector3; q: THREE.Quaternion };
}

/** Durações (ms): lançar uma carta na mesa, dar uma carta, mover o resto (juntar, cortar, arrastar o monte), virar. */
export const DUR = { throw: 600, deal: 350, move: 400, flip: 300, gap: 140 };

const EPS = 1e-4, _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const sameTarget = (c: CardGroup, p: THREE.Vector3, q: THREE.Quaternion) => c.userData.tp.distanceToSquared(p) < EPS * EPS && Math.abs(c.userData.tq.dot(q)) > 1 - EPS;

/**
 * Manda a carta para `p`/`q`. Destino igual ao atual não faz nada (o layout é chamado a cada snapshot); destino novo
 * troca o caminho por um trecho só. `at` atrasa a partida (ms absolutos); até lá a carta fica onde está.
 */
export function moveTo(card: CardGroup, p: THREE.Vector3, q: THREE.Quaternion, opts: { dur?: number; arc?: number; at?: number } = {}) {
  if (sameTarget(card, p, q)) return;
  card.userData.tp.copy(p); card.userData.tq.copy(q);
  card.userData.path = [{ p: p.clone(), q: q.clone(), t0: opts.at ?? performance.now(), dur: opts.dur ?? DUR.move, arc: opts.arc ?? 0 }];
}

/** Um caminho inteiro (a coreografia de dar as cartas): o último trecho vira o destino. */
export function setPath(card: CardGroup, path: Segment[]) {
  if (!path.length) return;
  const last = path[path.length - 1];
  card.userData.tp.copy(last.p); card.userData.tq.copy(last.q);
  card.userData.path = path.map((s) => ({ ...s, p: s.p.clone(), q: s.q.clone(), from: undefined }));
}

/** Põe a carta no destino já, sem animar (troca de mesa). */
export function snapTo(card: CardGroup) {
  card.userData.path = [];
  card.position.copy(card.userData.tp); card.quaternion.copy(card.userData.tq);
}

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** Avança a carta no seu caminho até `now`. Devolve se ela está em movimento. */
export function stepCard(card: CardGroup, now: number): boolean {
  const path = card.userData.path;
  while (path.length) {
    const seg = path[0];
    if (now < seg.t0) return false;
    if (!seg.from) seg.from = { p: card.position.clone(), q: card.quaternion.clone() };
    const u = seg.dur <= 0 ? 1 : Math.min(1, (now - seg.t0) / seg.dur);
    const e = ease(u);
    card.position.lerpVectors(seg.from.p, seg.p, e);
    if (seg.arc > 0) card.position.y += seg.arc * Math.sin(Math.PI * u);
    card.quaternion.slerpQuaternions(seg.from.q, seg.q, e);
    if (u < 1) return true;
    path.shift();
  }
  return false;
}

/** A carta ainda tem caminho pela frente (ou está no meio de um trecho). */
export const isMoving = (card: CardGroup) => card.userData.path.length > 0;

/** Ferramentas para montar caminhos: uma pose (posição + orientação) a partir de eixo/ângulos, reutilizando buffers. */
export const pose = (x: number, y: number, z: number, yaw: number, ex = 0, ey = 0, ez = 0) => ({
  p: new THREE.Vector3(x, y, z),
  q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(_q.setFromEuler(new THREE.Euler(ex, ey, ez, 'YXZ'))),
});
export const at = (x: number, y: number, z: number) => _p.set(x, y, z);
