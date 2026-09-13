import type { CardId, GameView, Seat } from '@truco/rules';
import * as THREE from 'three';
import type { Presence } from '../table/table';
import { seatDir, TABLE_TOP, type CardGroup, type Character } from './builders';
import { BUDDY_EYE } from './buddy/model';
import { angleDelta, presenceLean } from './camera';

const _v = new THREE.Vector3();
export const eyesWorld = (c: Character) => c.buddy.group.localToWorld(new THREE.Vector3(0, BUDDY_EYE, 0));

/** `view`: a cadeira de onde a câmera olha; -1 quando ela anda solta (fantasma ou de pé). */
export interface GazeCtx {
  game: GameView; view: Seat | -1; camera: THREE.Camera; chars: Character[];
  cards: Record<CardId, CardGroup>; lastPlay: { id: CardId | null; t: number }; acting: Seat | -1;
}

/** Para onde cada um olha: a carta que acabou de cair → quem fala → de quem é a vez → as próprias cartas. */
function gazePoint(c: Character, now: number, x: GazeCtx): THREE.Vector3 {
  if (c.seat === x.view) return x.camera.getWorldDirection(_v).multiplyScalar(1.5).add(x.camera.position);
  const h = x.game.hand;
  if (!h) return new THREE.Vector3(0, TABLE_TOP, 0);
  if (x.lastPlay.id && now - x.lastPlay.t < 1600) return x.cards[x.lastPlay.id].position.clone();
  const speaker = x.chars.find((o) => o.bubble.visible && o !== c);
  if (speaker) return eyesWorld(speaker);
  if (x.acting >= 0 && x.acting !== c.seat) return eyesWorld(x.chars[x.acting]);
  if (x.acting === c.seat) return seatDir(c.seat).multiplyScalar(0.8).setY(TABLE_TOP + 0.15);
  return new THREE.Vector3(0, TABLE_TOP, 0);
}

/** Olhar de quem joga pelo jogo (bots, e quem nunca mandou presença): mira um ponto da mesa. */
export function aimBuddy(c: Character, now: number, t: number, x: GazeCtx) {
  const p = c.buddy.group.worldToLocal(gazePoint(c, now, x));
  const yaw = Math.atan2(p.x, p.z) + Math.sin(t * 0.7 + c.seat * 3) * 0.04;
  const pitch = Math.atan2(p.y - BUDDY_EYE, Math.hypot(p.x, p.z));
  c.buddy.setLook(THREE.MathUtils.clamp(yaw, -1.2, 1.2), THREE.MathUtils.clamp(pitch, -0.7, 0.5));
  c.buddy.setLean(0);
}

/** Olhar de quem senta seguindo a presença que mandou: o yaw chega absoluto, o boneco é relativo à cadeira; a posição diz quanto se inclinou. */
export function aimPresence(c: Character, p: Presence) {
  const yaw = THREE.MathUtils.clamp(angleDelta(p.yaw, c.g.rotation.y), -1.35, 1.35);
  const pitch = THREE.MathUtils.clamp(p.pitch, -0.75, 0.6);
  c.buddy.setLook(yaw, pitch);
  c.buddy.setLean(presenceLean(c.seat, p));
}
