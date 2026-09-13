import type { Seat } from '@truco/rules';
import type { Presence } from '../table/table';
import { seatAngle, seatDir, SEAT_R, TABLE_R, TABLE_TOP } from './builders';
import { BUDDY_EYE, BUDDY_EYE_FORWARD, STOOL_H } from './buddy/model';
import { SEAT_FOOT_R } from './scenery/kit';

/** Olhar em primeira pessoa: yaw/pitch alvo (mouse) e suavizado (frame). Sentada, relativos à cadeira; de pé ou fantasma, absolutos. */
export const look = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
/** A câmera sentada fica nos olhos do boneco: à altura deles, um pouco à frente do centro da cadeira. */
export const EYE_H = BUDDY_EYE, CAM_DIST = SEAT_R - BUDDY_EYE_FORWARD, LOOK_H = 0.7;
export const BASE_PITCH = -Math.atan2(EYE_H - LOOK_H, CAM_DIST);
export function resetLook() { look.tyaw = 0; look.tpitch = 0; }

/** Zoom (botão direito): a câmera avança `ZOOM_DIST` na direção do olhar e o boneco se inclina junto; `t` é o quanto já avançou (0..1). */
export const zoom = { on: false, t: 0 };
export const ZOOM_DIST = 0.35, FOV = 62, ZOOM_FOV = 48;

/** Postura da pessoa sentada: `standing` quando se levantou da cadeira (anda e pula como um fantasma; a cadeira continua dela). */
export const stance = { standing: false };

/** Quem anda (fantasma ou de pé): onde está, a altura e a velocidade vertical (pulo), e que teclas de andar estão apertadas. */
export const walk = { x: 0, y: 0, z: 0, vy: 0, airborne: false, keys: new Set<string>() };
export const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
/** Velocidade (m/s), onde um fantasma fica de pé atrás de uma cadeira, até onde pode ir e a que distância da mesa esbarra. */
export const WALK_SPEED = 2.2, GHOST_STAND_R = SEAT_R + 1.1, WALK_MIN_R = TABLE_R + 0.45;
/** Até onde se anda e a altura do chão fora da mesa e das cadeiras: o cenário põe a cerca e o chão dele aqui. */
export const walkBounds = { maxR: 6.4, floorAt: (_x: number, _z: number) => 0 };
/** Pulo: gravidade e impulso; sobe perto de um metro, o bastante para subir na mesa. */
export const GRAVITY = 16, JUMP_V = 5.6;
/** A que distância da própria cadeira dá para sentar de novo. */
export const SIT_RANGE = 1.0;
/** Quanto um quique sentado sobe, na presença que os outros veem. */
export const BOUNCE_Y = 0.12;

/** Onde um fantasma fica de pé atrás da cadeira `seat`, olhando para a mesa. */
export function standSpot(seat: Seat): Presence { const d = seatDir(seat).multiplyScalar(GHOST_STAND_R); return { x: d.x, y: 0, z: d.z, yaw: seatAngle(seat), pitch: -0.15 }; }
/** Onde fica a câmera de quem senta na cadeira `seat` (sem zoom). */
export function seatSpot(seat: Seat) { return seatDir(seat).multiplyScalar(CAM_DIST).setY(EYE_H); }
/** Atrás de que cadeira o i-ésimo fantasma nasce (até a presença dele chegar). */
export const spawnSeat = (i: number) => (i % 4) as Seat;
/** Põe o fantasma local de pé atrás da cadeira `seat`. */
export function standBehind(seat: Seat) {
  const s = standSpot(seat);
  walk.x = s.x; walk.z = s.z; walk.y = 0; walk.vy = 0; walk.airborne = false;
  look.yaw = look.tyaw = s.yaw; look.pitch = look.tpitch = s.pitch;
}

/** O chão onde se pisa em (x, z): o tampo da mesa dentro dela, o assento sobre uma cadeira, o chão do cenário no resto. */
export function floorAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r < TABLE_R) return TABLE_TOP;
  for (let s = 0 as Seat; s < 4; s = (s + 1) as Seat) { const d = seatDir(s).multiplyScalar(SEAT_R); if (Math.hypot(x - d.x, z - d.z) < SEAT_FOOT_R) return STOOL_H; }
  return walkBounds.floorAt(x, z);
}

/**
 * Anda `dt` segundos na direção das teclas, a partir do olhar, e cai ou sobe com o pulo. A câmera olha para -z:
 * frente = (-sin, -cos), direita = (cos, -sin). No chão, a mesa é parede: quem está abaixo do tampo não entra nela;
 * quem pula por cima aterrissa no tampo e anda nele.
 */
export function stepWalk(dt: number) {
  const k = walk.keys;
  const fwd = +(k.has('KeyW') || k.has('ArrowUp')) - +(k.has('KeyS') || k.has('ArrowDown'));
  const side = +(k.has('KeyD') || k.has('ArrowRight')) - +(k.has('KeyA') || k.has('ArrowLeft'));
  if (fwd || side) {
    const v = WALK_SPEED * dt / Math.hypot(fwd, side);
    const s = Math.sin(look.yaw), c = Math.cos(look.yaw);
    walk.x += (-s * fwd + c * side) * v;
    walk.z += (-c * fwd - s * side) * v;
  }
  const r = Math.hypot(walk.x, walk.z);
  const belowTop = walk.y < TABLE_TOP - 0.02;
  const min = belowTop ? WALK_MIN_R : 0;
  const clamped = Math.min(walkBounds.maxR, Math.max(min, r));
  if (clamped !== r && r > 0) { walk.x *= clamped / r; walk.z *= clamped / r; }
  walk.vy -= GRAVITY * dt;
  walk.y += walk.vy * dt;
  const floor = floorAt(walk.x, walk.z);
  if (walk.y <= floor && walk.vy <= 0) { walk.y = floor; walk.vy = 0; walk.airborne = false; }
  else walk.airborne = true;
}

/** Pula, se estiver com os pés em algo. Devolve se pulou. */
export function jump(): boolean {
  if (walk.airborne) return false;
  walk.vy = JUMP_V; walk.airborne = true;
  return true;
}

/** Levanta da cadeira `seat`: fica de pé sobre o assento, com o olhar que tinha, e já sai pulando. */
export function standUp(seat: Seat) {
  const d = seatDir(seat).multiplyScalar(SEAT_R);
  walk.x = d.x; walk.z = d.z; walk.y = STOOL_H; walk.vy = 0; walk.airborne = false;
  const yaw = seatAngle(seat) + look.yaw, pitch = BASE_PITCH + look.pitch;
  look.yaw = look.tyaw = yaw; look.pitch = look.tpitch = pitch;
  stance.standing = true;
  jump();
}

/** Perto o bastante da própria cadeira para sentar. */
export function nearSeat(seat: Seat) {
  const d = seatDir(seat).multiplyScalar(SEAT_R);
  return Math.hypot(walk.x - d.x, walk.z - d.z) < SIT_RANGE;
}

/** Senta de novo: o olhar volta a ser relativo à cadeira. */
export function sitDown() {
  stance.standing = false;
  walk.keys.clear(); walk.vy = 0; walk.airborne = false;
  resetLook(); look.yaw = 0; look.pitch = 0;
}

/** Quem senta e mandou uma presença longe da cadeira, ou à altura do assento ou acima, está de pé (um quique sentado fica abaixo). */
export function presenceStanding(seat: Seat, p: Presence) {
  const s = seatSpot(seat);
  return Math.hypot(p.x - s.x, p.z - s.z) > ZOOM_DIST + 0.25 || p.y >= STOOL_H - 0.02;
}

/** Quanto quem senta se inclinou sobre a mesa, lido da posição da câmera que mandou (0..1). */
export function presenceLean(seat: Seat, p: Presence) {
  const d = seatDir(seat);
  const along = p.x * d.x + p.z * d.z;
  return Math.max(0, Math.min(1, (CAM_DIST - along) / ZOOM_DIST));
}

/** Diferença de ângulo em (-π, π]. */
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
