import { MANILHA, RANKS, SUITS, makeDeck, type CardId, type Seat, type Suit } from '@truco/rules';
import * as THREE from 'three';
import type { Presence } from '../table/table';
import { BUDDY_HEIGHT, createBuddy, STOOL_H, type Buddy } from './buddy/model';
import { outfitFor } from './buddy/molho';

export const TABLE_R = 1.2, TABLE_TOP = 0.76, SEAT_R = 1.62;
export const CARD_W = 0.19, CARD_H = 0.27;
export const UI_FONT = '"JetBrains Mono", "Caskaydia Cove", ui-monospace, Menlo, monospace';

export const seatAngle = (s: Seat) => s * Math.PI / 2;
export const seatDir = (s: Seat) => new THREE.Vector3(Math.sin(seatAngle(s)), 0, Math.cos(seatAngle(s)));
export const seatRight = (s: Seat) => new THREE.Vector3(Math.cos(seatAngle(s)), 0, -Math.sin(seatAngle(s)));

const flat = (color: number) => new THREE.MeshLambertMaterial({ color });
const place = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };

/** O boneco de uma cadeira: senta no banquinho olhando para a mesa, ou anda pela mesa quando a pessoa se levanta. */
export interface Character {
  seat: Seat; name: string; bot: boolean; molhoKey: string; g: THREE.Group; buddy: Buddy;
  label: THREE.Sprite; labelOn: THREE.Sprite; bubble: THREE.Sprite; bubbleUntil: number; talkUntil: number;
  /** de pé (a presença chegou longe da cadeira); a posição e o pulo vêm da presença */
  standing: boolean; air: boolean; bounced: number; prev: THREE.Vector3;
  /** a reação mais recente, para uma mais antiga não desfazer uma nova ao terminar */
  reaction: number;
}

const LABEL_COLOR = '#dae0da', LABEL_ON_COLOR = '#66ef73';
const LABEL_Y = BUDDY_HEIGHT + 0.12, BUBBLE_Y = BUDDY_HEIGHT + 0.34;

/** O boneco olha para +z; a cadeira olha para -z (a mesa): o boneco entra virado. */
function mount(buddy: Buddy, g: THREE.Group) { buddy.group.rotation.y = Math.PI; g.add(buddy.group); }

/** Boneco sentado no banquinho da cadeira `seat`, com o molho de quem senta (`molhoKey`: o apelido que dá o molho, quando não é o nome mostrado). Origem no chão, sob o banquinho. */
export function makeCharacter(seat: Seat, name: string, bot: boolean, molhoKey = name): Character {
  const g = new THREE.Group();
  const buddy = createBuddy({ outfit: outfitFor(molhoKey, bot, 'OnTable') });
  buddy.setSeated(true);
  mount(buddy, g);
  const label = place(makeTextSprite(name, LABEL_COLOR), 0, LABEL_Y, 0); g.add(label);
  const labelOn = place(makeTextSprite(name, LABEL_ON_COLOR), 0, LABEL_Y, 0); labelOn.visible = false; g.add(labelOn);
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
  bubble.position.set(0, BUBBLE_Y, 0); bubble.scale.set(0.7, 0.175, 1); bubble.visible = false; g.add(bubble);
  g.position.copy(seatDir(seat).multiplyScalar(SEAT_R)); g.rotation.y = seatAngle(seat);
  return { seat, name, bot, molhoKey, g, buddy, label, labelOn, bubble, bubbleUntil: 0, talkUntil: 0, standing: false, air: false, bounced: 0, prev: g.position.clone(), reaction: 0 };
}

/** Quem senta na cadeira mudou: o nome sobre a cabeça e o molho seguem. */
export function nameCharacter(ch: Character, name: string, bot: boolean, molhoKey = name) {
  if (ch.name === name && ch.bot === bot && ch.molhoKey === molhoKey) return;
  ch.name = name; ch.bot = bot; ch.molhoKey = molhoKey;
  ch.buddy.setOutfit(outfitFor(molhoKey, bot, 'OnTable'));
  for (const [sprite, color] of [[ch.label, LABEL_COLOR], [ch.labelOn, LABEL_ON_COLOR]] as const) {
    const mat = sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose(); mat.map = textTexture(name, color); mat.needsUpdate = true;
  }
}

/** O banquinho de uma cadeira: fica no lugar quando a pessoa se levanta. */
export function makeStool(seat: Seat): THREE.Group {
  const g = new THREE.Group();
  const wood = flat(0x6b5a48), leg = flat(0x4a3f34);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.05, 20), wood); top.position.y = STOOL_H - 0.025; top.castShadow = top.receiveShadow = true; g.add(top);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3 + Math.PI / 6;
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, STOOL_H - 0.05, 8), leg);
    l.position.set(Math.sin(a) * 0.22, (STOOL_H - 0.05) / 2, Math.cos(a) * 0.22); l.castShadow = true; g.add(l);
  }
  g.position.copy(seatDir(seat).multiplyScalar(SEAT_R)); g.rotation.y = seatAngle(seat);
  return g;
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
  ch.talkUntil = now + 900; ch.bubbleUntil = now + 1700;
  const c = document.createElement('canvas'); c.width = 320; c.height = 80; const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(218,224,218,.96)'; x.fillRect(4, 4, 312, 72);
  x.font = `bold 38px ${UI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#100f10'; x.fillText(text, 160, 42);
  const mat = ch.bubble.material as THREE.SpriteMaterial;
  mat.map?.dispose(); mat.map = canvasTexture(c); mat.needsUpdate = true; ch.bubble.visible = true;
}

/** Outro fantasma na mesa: um vulto do boneco dele, sem nome; `target` é a presença mais recente, seguida por quadro. */
export interface Ghost { id: string; name: string; g: THREE.Group; buddy: Buddy; target: Presence; air: boolean; prev: THREE.Vector3 }

export function makeGhost(id: string, name: string, at: Presence): Ghost {
  const g = new THREE.Group();
  const buddy = createBuddy({ ghost: true, outfit: outfitFor(name, false, 'Relaxed') });
  mount(buddy, g);
  g.position.set(at.x, at.y, at.z); g.rotation.y = at.yaw;
  return { id, name, g, buddy, target: { ...at }, air: false, prev: g.position.clone() };
}

/** O fantasma saiu da mesa: solta o que a GPU guardava dele. */
export function disposeGhost(gh: Ghost) { gh.buddy.dispose(); }

/** O apelido de um fantasma mudou: o vulto troca de molho. */
export function nameGhost(gh: Ghost, name: string) {
  if (gh.name === name) return;
  gh.name = name;
  gh.buddy.setOutfit(outfitFor(name, false, 'Relaxed'));
}

/** Um fantasma que caiu fica mais apagado. */
export function ghostOpacity(gh: Ghost, connected: boolean) {
  for (const m of Object.values(gh.buddy.materials)) m.opacity = m.name === 'ghostInk' ? (connected ? 0.85 : 0.4) : (connected ? 0.4 : 0.18);
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

/** `known`: a pessoa sabe que carta é (vê a face); senão as duas faces mostram as costas. */
export interface CardData { tp: THREE.Vector3; tq: THREE.Quaternion; b: number; tb: number; known: boolean; front: THREE.Mesh; face: THREE.Texture; back: THREE.Texture }
export type CardGroup = THREE.Group & { userData: CardData & { id: CardId } };

export function buildCards(): Record<CardId, CardGroup> {
  const back = backTexture();
  const out = {} as Record<CardId, CardGroup>;
  for (const id of makeDeck()) {
    const g = new THREE.Group() as CardGroup;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshLambertMaterial({ map: faceTexture(id) })) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshLambertMaterial>;
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshLambertMaterial({ map: back }));
    rear.rotation.y = Math.PI; front.castShadow = true;
    g.add(front, rear);
    g.userData = { id, tp: new THREE.Vector3(0.6, TABLE_TOP, -0.6), tq: new THREE.Quaternion(), b: 1, tb: 1, known: true, front, face: front.material.map!, back };
    g.position.copy(g.userData.tp);
    out[id] = g;
  }
  return out;
}

/** Mostra a face de uma carta só a quem a conhece; para os outros, costas dos dois lados. */
export function showFace(card: CardGroup, known: boolean) {
  const d = card.userData;
  if (d.known === known) return;
  d.known = known;
  const m = d.front.material as THREE.MeshLambertMaterial;
  m.map = known ? d.face : d.back; m.needsUpdate = true;
}

void RANKS;
