import { MANILHA, RANKS, SUITS, makeDeck, type CardId, type Seat, type Suit } from '@truco/rules';
import * as THREE from 'three';
import type { Presence } from '../table/table';

export const TABLE_R = 1.2, TABLE_TOP = 0.76, SEAT_R = 1.55;
export const CARD_W = 0.19, CARD_H = 0.27;
export const HEAD_Y = 1.35;
export const UI_FONT = '"JetBrains Mono", "Caskaydia Cove", ui-monospace, Menlo, monospace';

export const seatAngle = (s: Seat) => s * Math.PI / 2;
export const seatDir = (s: Seat) => new THREE.Vector3(Math.sin(seatAngle(s)), 0, Math.cos(seatAngle(s)));
export const seatRight = (s: Seat) => new THREE.Vector3(Math.cos(seatAngle(s)), 0, -Math.sin(seatAngle(s)));

export interface Preset { skin: number; hair: number; shirt: number; pants: number; acc: 'cap' | 'glasses' | 'bun' | 'stache' }
export const PRESETS: Preset[] = [
  { skin: 0xd9a37c, hair: 0x2b1d14, shirt: 0xc8402e, pants: 0x2f3542, acc: 'cap' },
  { skin: 0x8d5a3b, hair: 0x111111, shirt: 0x3a6ea5, pants: 0x4b4b4b, acc: 'glasses' },
  { skin: 0xf1c9a5, hair: 0x8c5a2b, shirt: 0x4f9d5a, pants: 0x5a4636, acc: 'bun' },
  { skin: 0xb98261, hair: 0x3d3d3d, shirt: 0xe8b53a, pants: 0x2f3542, acc: 'stache' },
];

const flat = (color: number) => new THREE.MeshLambertMaterial({ color });
const place = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };
const box = (w: number, h: number, d: number, color: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color)); m.castShadow = m.receiveShadow = true; return m;
};

export interface Character {
  seat: Seat; name: string; g: THREE.Group; head: THREE.Group; mouth: THREE.Mesh; torso: THREE.Mesh;
  label: THREE.Sprite; labelOn: THREE.Sprite; bubble: THREE.Sprite; mouthUntil: number; bubbleUntil: number;
}

const LABEL_COLOR = '#dae0da', LABEL_ON_COLOR = '#66ef73', GHOST_LABEL_COLOR = '#b8cfee';

/** Humanoide low-poly sentado, olhando para -z local. Origem no chão, sob a cadeira. */
export function makeCharacter(seat: Seat, p: Preset, name: string): Character {
  const g = new THREE.Group();
  g.add(place(box(0.5, 0.06, 0.5, 0x6b6b6b), 0, 0.45, 0));
  g.add(place(box(0.5, 0.55, 0.06, 0x6b6b6b), 0, 0.72, 0.24));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(place(box(0.05, 0.45, 0.05, 0x5a5a5a), x, 0.22, z));
  for (const x of [-0.11, 0.11]) {
    g.add(place(box(0.17, 0.15, 0.44, p.pants), x, 0.55, -0.16));
    g.add(place(box(0.15, 0.4, 0.15, p.pants), x, 0.27, -0.36));
    g.add(place(box(0.15, 0.08, 0.24, 0x222222), x, 0.04, -0.42));
  }
  const torso = place(box(0.44, 0.52, 0.24, p.shirt), 0, 0.86, 0.02); g.add(torso);
  g.add(place(box(0.12, 0.08, 0.12, p.skin), 0, 1.15, 0));
  for (const x of [-0.29, 0.29]) {
    const upper = place(box(0.11, 0.3, 0.11, p.shirt), x, 0.98, -0.06); upper.rotation.x = 0.55; g.add(upper);
    g.add(place(box(0.1, 0.09, 0.34, p.skin), x, TABLE_TOP + 0.05, -0.33));
    g.add(place(box(0.11, 0.07, 0.12, p.skin), x, TABLE_TOP + 0.05, -0.53));
  }
  const head = new THREE.Group(); head.position.set(0, HEAD_Y, 0);
  head.add(box(0.3, 0.32, 0.3, p.skin));
  const F = -0.151;
  for (const x of [-0.065, 0.065]) {
    head.add(place(box(0.07, 0.05, 0.01, 0xffffff), x, 0.03, F));
    head.add(place(box(0.03, 0.035, 0.012, 0x1a1a1a), x + (x < 0 ? 0.01 : -0.01), 0.03, F - 0.003));
    const brow = place(box(0.08, 0.018, 0.01, p.hair), x, 0.085, F); brow.rotation.z = x < 0 ? 0.15 : -0.15; head.add(brow);
  }
  head.add(place(box(0.04, 0.06, 0.03, p.skin), 0, -0.01, F - 0.01));
  const mouth = place(box(0.09, 0.018, 0.01, 0x7a2e2e), 0, -0.085, F); head.add(mouth);
  head.add(place(box(0.32, 0.07, 0.32, p.hair), 0, 0.175, 0.005));
  head.add(place(box(0.32, 0.18, 0.06, p.hair), 0, 0.07, 0.145));
  for (const x of [-0.155, 0.155]) head.add(place(box(0.02, 0.07, 0.05, p.skin), x, -0.01, 0.01));
  if (p.acc === 'cap') {
    head.add(place(box(0.34, 0.09, 0.34, 0x2f3542), 0, 0.2, 0));
    head.add(place(box(0.3, 0.02, 0.16, 0x2f3542), 0, 0.16, -0.22));
  } else if (p.acc === 'glasses') {
    for (const x of [-0.065, 0.065]) head.add(place(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 16), flat(0x111111)), x, 0.03, F - 0.01));
    head.add(place(box(0.04, 0.006, 0.006, 0x111111), 0, 0.03, F - 0.01));
  } else if (p.acc === 'bun') {
    head.add(place(box(0.16, 0.14, 0.16, p.hair), 0, 0.24, 0.06));
  } else if (p.acc === 'stache') {
    head.add(place(box(0.12, 0.03, 0.02, p.hair), 0, -0.05, F - 0.005));
  }
  g.add(head);
  const label = place(makeTextSprite(name, LABEL_COLOR), 0, 1.72, 0); g.add(label);
  const labelOn = place(makeTextSprite(name, LABEL_ON_COLOR), 0, 1.72, 0); labelOn.visible = false; g.add(labelOn);
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
  bubble.position.set(0, 1.95, 0); bubble.scale.set(0.7, 0.175, 1); bubble.visible = false; g.add(bubble);
  g.position.copy(seatDir(seat).multiplyScalar(SEAT_R)); g.rotation.y = seatAngle(seat);
  return { seat, name, g, head, mouth, torso, label, labelOn, bubble, mouthUntil: 0, bubbleUntil: 0 };
}

/** Troca o nome sobre a cabeça (quem senta na cadeira mudou). */
export function nameCharacter(ch: Character, name: string) {
  if (ch.name === name) return;
  ch.name = name;
  for (const [sprite, color] of [[ch.label, LABEL_COLOR], [ch.labelOn, LABEL_ON_COLOR]] as const) {
    const mat = sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose(); mat.map = textTexture(name, color); mat.needsUpdate = true;
  }
}

function canvasTexture(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

function textTexture(text: string, color: string, size = 40, w = 256, h = 64) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  x.font = `bold ${size}px ${UI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(text, w / 2, h / 2); x.fillStyle = color; x.fillText(text, w / 2, h / 2);
  return canvasTexture(c);
}

export function makeTextSprite(text: string, color: string) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, color), transparent: true, depthTest: false }));
  sp.scale.set(0.5, 0.125, 1); return sp;
}

/** Balão de fala + boca mexendo. */
export function sayTo(ch: Character, text: string) {
  const now = performance.now();
  ch.mouthUntil = now + 900; ch.bubbleUntil = now + 1700;
  const c = document.createElement('canvas'); c.width = 320; c.height = 80; const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(218,224,218,.96)'; x.fillRect(4, 4, 312, 72);
  x.font = `bold 38px ${UI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#100f10'; x.fillText(text, 160, 42);
  const mat = ch.bubble.material as THREE.SpriteMaterial;
  mat.map?.dispose(); mat.map = canvasTexture(c); mat.needsUpdate = true; ch.bubble.visible = true;
}

/** Outro fantasma na mesa: vulto translúcido de pé, com o nome em cima; `target` é a presença mais recente dele, seguida por quadro. */
export interface Ghost { id: string; name: string; g: THREE.Group; head: THREE.Group; label: THREE.Sprite; mat: THREE.MeshLambertMaterial; target: Presence }

export function makeGhost(id: string, name: string, at: Presence): Ghost {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xcfe3ff, transparent: true, opacity: 0.4, depthWrite: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 1.0, 10), mat); body.position.y = 0.95; g.add(body);
  const head = new THREE.Group(); head.position.y = 1.55;
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), mat));
  const eye = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.85 });
  for (const x of [-0.065, 0.065]) head.add(place(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.01), eye), x, 0.03, -0.151));
  g.add(head);
  const label = place(makeTextSprite(name, GHOST_LABEL_COLOR), 0, 1.95, 0); g.add(label);
  g.position.set(at.x, 0, at.z); g.rotation.y = at.yaw; head.rotation.x = at.pitch;
  return { id, name, g, head, label, mat, target: { ...at } };
}

/** O fantasma saiu da mesa: solta o que a GPU guardava dele. */
export function disposeGhost(gh: Ghost) {
  gh.g.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
  const mat = gh.label.material as THREE.SpriteMaterial;
  mat.map?.dispose(); mat.dispose();
}

/** Troca o nome sobre a cabeça de um fantasma. */
export function nameGhost(gh: Ghost, name: string) {
  if (gh.name === name) return;
  gh.name = name;
  const mat = gh.label.material as THREE.SpriteMaterial;
  mat.map?.dispose(); mat.map = textTexture(name, GHOST_LABEL_COLOR); mat.needsUpdate = true;
}

/* ---------- cartas procedurais ---------- */
function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
function backTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 364; const x = c.getContext('2d')!;
  x.fillStyle = '#f3ead8'; roundRect(x, 0, 0, 256, 364, 20); x.fill();
  x.fillStyle = '#3a6ea5'; roundRect(x, 14, 14, 228, 336, 14); x.fill();
  x.strokeStyle = 'rgba(243,234,216,.55)'; x.lineWidth = 2;
  for (let i = -364; i < 364; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 364, 364); x.stroke(); x.beginPath(); x.moveTo(i + 364, 0); x.lineTo(i, 364); x.stroke(); }
  x.fillStyle = '#3a6ea5'; roundRect(x, 30, 30, 196, 304, 10); x.fill();
  return canvasTexture(c);
}
function faceTexture(id: CardId) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 364; const x = c.getContext('2d')!;
  const suit = id[1] as Suit; const red = suit === 'h' || suit === 'd'; const col = red ? '#c8402e' : '#1a1a1a';
  x.fillStyle = '#fbf7ee'; roundRect(x, 0, 0, 256, 364, 20); x.fill();
  if (MANILHA[id]) { x.strokeStyle = '#e8b53a'; x.lineWidth = 10; roundRect(x, 8, 8, 240, 348, 16); x.stroke(); }
  x.fillStyle = col; x.textBaseline = 'top';
  const r = id[0], s = SUITS[suit];
  x.font = `bold 56px ${UI_FONT}`; x.textAlign = 'left'; x.fillText(r, 18, 14);
  x.font = '48px sans-serif'; x.fillText(s, 20, 68);
  x.save(); x.translate(256, 364); x.rotate(Math.PI);
  x.font = `bold 56px ${UI_FONT}`; x.fillText(r, 18, 14); x.font = '48px sans-serif'; x.fillText(s, 20, 68); x.restore();
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '150px sans-serif'; x.fillText(s, 128, 190);
  if (MANILHA[id]) { x.fillStyle = '#b8862b'; x.font = `bold 22px ${UI_FONT}`; x.fillText('MANILHA', 128, 300); }
  return canvasTexture(c);
}

export interface CardData { tp: THREE.Vector3; tq: THREE.Quaternion; b: number; tb: number }
export type CardGroup = THREE.Group & { userData: CardData & { id: CardId } };

export function buildCards(): Record<CardId, CardGroup> {
  const back = backTexture();
  const out = {} as Record<CardId, CardGroup>;
  for (const id of makeDeck()) {
    const g = new THREE.Group() as CardGroup;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshLambertMaterial({ map: faceTexture(id) }));
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshLambertMaterial({ map: back }));
    rear.rotation.y = Math.PI; front.castShadow = true;
    g.add(front, rear);
    g.userData = { id, tp: new THREE.Vector3(0.6, TABLE_TOP, -0.6), tq: new THREE.Quaternion(), b: 1, tb: 1 };
    g.position.copy(g.userData.tp);
    out[id] = g;
  }
  return out;
}

void RANKS;
