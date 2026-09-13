import type { Seat } from '@truco/rules';
import type { Presence } from '../table/table';
import { seatAngle, seatDir, SEAT_R, TABLE_R } from './builders';

/** Olhar em primeira pessoa: yaw/pitch alvo (mouse) e suavizado (frame). Sentada, relativos à cadeira; fantasma, absolutos. */
export const look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
export const CAM_DIST = 1.45, CAM_H = 1.4, LOOK_H = 0.7;
export const BASE_PITCH = -Math.atan2(CAM_H - LOOK_H, CAM_DIST);
export function resetLook() { look.tyaw = 0; look.tpitch = 0; }

/** Fantasma: onde está no chão e que teclas de andar estão apertadas (o World integra por quadro). */
export const walk = { x: 0, z: 0, keys: new Set<string>() };
export const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
/** Altura dos olhos de um fantasma, velocidade (m/s), onde fica de pé atrás de uma cadeira e até onde pode ir (nunca dentro da mesa). */
export const GHOST_EYE = 1.55, GHOST_SPEED = 2.2, GHOST_STAND_R = SEAT_R + 1.1, WALK_MAX_R = 6, WALK_MIN_R = TABLE_R + 0.45;

/** Onde um fantasma fica de pé atrás da cadeira `seat`, olhando para a mesa. */
export function standSpot(seat: Seat): Presence { const d = seatDir(seat).multiplyScalar(GHOST_STAND_R); return { x: d.x, z: d.z, yaw: seatAngle(seat), pitch: -0.15 }; }
/** Atrás de que cadeira o i-ésimo fantasma nasce (até a presença dele chegar). */
export const spawnSeat = (i: number) => (i % 4) as Seat;
/** Põe o fantasma local de pé atrás da cadeira `seat`. */
export function standBehind(seat: Seat) {
  const s = standSpot(seat);
  walk.x = s.x; walk.z = s.z;
  look.yaw = look.tyaw = s.yaw; look.pitch = look.tpitch = s.pitch;
}
/** Anda `dt` segundos na direção das teclas, a partir do olhar; a câmera olha para -z: frente = (-sin, -cos), direita = (cos, -sin). */
export function stepWalk(dt: number) {
  const k = walk.keys;
  const fwd = +(k.has('KeyW') || k.has('ArrowUp')) - +(k.has('KeyS') || k.has('ArrowDown'));
  const side = +(k.has('KeyD') || k.has('ArrowRight')) - +(k.has('KeyA') || k.has('ArrowLeft'));
  if (!fwd && !side) return;
  const v = GHOST_SPEED * dt / Math.hypot(fwd, side);
  const s = Math.sin(look.yaw), c = Math.cos(look.yaw);
  walk.x += (-s * fwd + c * side) * v;
  walk.z += (-c * fwd - s * side) * v;
  const r = Math.hypot(walk.x, walk.z);
  const clamped = Math.min(WALK_MAX_R, Math.max(WALK_MIN_R, r));
  if (clamped !== r && r > 0) { walk.x *= clamped / r; walk.z *= clamped / r; }
}
/** Menor diferença entre dois ângulos, em (-π, π]. */
export const angleDelta = (to: number, from: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
