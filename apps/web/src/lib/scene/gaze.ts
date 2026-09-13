import type { CardId, GameView, Seat } from '@truco/rules';
import * as THREE from 'three';
import { HEAD_Y, seatDir, TABLE_TOP, type CardGroup, type Character } from './builders';

const _v = new THREE.Vector3();
export const headWorld = (c: Character) => c.g.localToWorld(new THREE.Vector3(0, HEAD_Y, 0));

export interface GazeCtx {
  game: GameView; view: Seat; camera: THREE.Camera; chars: Character[];
  cards: Record<CardId, CardGroup>; lastPlay: { id: CardId | null; t: number }; acting: Seat | -1;
}

/** Para onde cada um olha: a carta que acabou de cair → quem fala → de quem é a vez → as próprias cartas. */
function gazePoint(c: Character, now: number, x: GazeCtx): THREE.Vector3 {
  if (c.seat === x.view) return x.camera.getWorldDirection(_v).multiplyScalar(1.5).add(x.camera.position);
  const h = x.game.hand;
  if (!h) return new THREE.Vector3(0, TABLE_TOP, 0);
  if (x.lastPlay.id && now - x.lastPlay.t < 1600) return x.cards[x.lastPlay.id].position.clone();
  const speaker = x.chars.find((o) => o.bubble.visible && o !== c);
  if (speaker) return headWorld(speaker);
  if (x.acting >= 0 && x.acting !== c.seat) return headWorld(x.chars[x.acting]);
  if (x.acting === c.seat) return seatDir(c.seat).multiplyScalar(0.8).setY(TABLE_TOP + 0.15);
  return new THREE.Vector3(0, TABLE_TOP, 0);
}

export function aimHead(c: Character, now: number, t: number, x: GazeCtx) {
  const p = c.g.worldToLocal(gazePoint(c, now, x)); p.y -= HEAD_Y;
  const yaw = THREE.MathUtils.clamp(Math.atan2(-p.x, -p.z), -1.2, 1.2) + Math.sin(t * 0.7 + c.seat * 3) * 0.04;
  const pitch = THREE.MathUtils.clamp(Math.atan2(p.y, Math.hypot(p.x, p.z)), -0.7, 0.5);
  c.head.rotation.y += (yaw - c.head.rotation.y) * 0.08;
  c.head.rotation.x += (pitch - c.head.rotation.x) * 0.08;
}
