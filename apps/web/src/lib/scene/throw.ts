import type { PlayKind, Seat } from '@truco/rules';
import * as THREE from 'three';
import { seatAngle, seatDir, seatRight } from './builders';

export interface Spot { x: number; z: number; yaw: number }

/** mulberry32 a partir da semente da jogada: todo mundo sorteia a mesma posição. */
function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Onde a carta cai na mesa — "humanamente" aleatório, mas só a partir da semente que veio com a jogada,
 * para a carta cair no mesmo lugar em toda tela.
 * lead: sai perto do centro, mais ou menos alinhada;
 * kill: bate em cima da carta que está matando, puxada para quem jogou e atravessada;
 * tie:  embucha ao lado da carta empatada;
 * lose: queima — cai mais perto de quem jogou, mais torta;
 * cover: coberta, largada perto do jogador, torta.
 */
export function throwSpot(seat: Seat, kind: PlayKind, ref: Spot | null, seed: number): Spot {
  const rng = rngFrom(seed), rnd = (m: number) => (rng() * 2 - 1) * m;
  const a = seatAngle(seat), dir = seatDir(seat), right = seatRight(seat);
  let p: THREE.Vector3, yaw: number;
  if (kind === 'kill' && ref) { p = new THREE.Vector3(ref.x, 0, ref.z).addScaledVector(dir, 0.04 + rng() * 0.07).addScaledVector(right, rnd(0.05)); yaw = a + rnd(0.6); }
  else if (kind === 'tie' && ref) { const side = rng() < 0.5 ? -1 : 1; p = new THREE.Vector3(ref.x, 0, ref.z).addScaledVector(right, side * (0.12 + rng() * 0.06)).addScaledVector(dir, rnd(0.05)); yaw = a + rnd(0.45); }
  else if (kind === 'lead') { p = dir.clone().multiplyScalar(0.27 + rng() * 0.12).addScaledVector(right, rnd(0.09)); yaw = a + rnd(0.3); }
  else if (kind === 'cover') { p = dir.clone().multiplyScalar(0.44 + rng() * 0.12).addScaledVector(right, rnd(0.15)); yaw = a + rnd(0.9); }
  else { p = dir.clone().multiplyScalar(0.4 + rng() * 0.15).addScaledVector(right, rnd(0.16)); yaw = a + rnd(0.65); }
  return { x: p.x, z: p.z, yaw };
}
