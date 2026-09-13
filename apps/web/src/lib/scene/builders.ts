import { makeDeck, type CardId, type Seat } from '@truco/rules';
import * as THREE from 'three';
import type { Presence } from '../table/table';
import { BUDDY_HEIGHT, createBuddy, type Buddy } from './buddy/model';
import { outfitFor } from './buddy/molho';
import type { DeckArt } from './scenery/scenery';
import type { Segment } from './tween';

export const TABLE_R = 1.2, TABLE_TOP = 0.76, SEAT_R = 1.62;
export const CARD_W = 0.19, CARD_H = 0.27;
export const UI_FONT = '"JetBrains Mono", "Caskaydia Cove", ui-monospace, Menlo, monospace';

export const seatAngle = (s: Seat) => s * Math.PI / 2;
export const seatDir = (s: Seat) => new THREE.Vector3(Math.sin(seatAngle(s)), 0, Math.cos(seatAngle(s)));
export const seatRight = (s: Seat) => new THREE.Vector3(Math.cos(seatAngle(s)), 0, -Math.sin(seatAngle(s)));
/** Onde o monte fica durante a mão: na frente da mão (a cadeira à direita do carteador), do lado direito dela, fora do caminho das cartas. */
export const monteSpot = (mao: Seat) => seatDir(mao).multiplyScalar(0.70).addScaledVector(seatRight(mao), 0.42);

const place = <T extends THREE.Object3D>(m: T, x: number, y: number, z: number) => { m.position.set(x, y, z); return m; };

/** O boneco de uma cadeira: senta na cadeira do cenário olhando para a mesa, ou anda pela mesa quando a pessoa se levanta. */
export interface Character {
  seat: Seat; name: string; bot: boolean; molhoKey: string; g: THREE.Group; buddy: Buddy;
  label: THREE.Sprite; labelOn: THREE.Sprite; bubble: THREE.Sprite; bubbleUntil: number; talkUntil: number;
  /** de pé (a presença chegou longe da cadeira); a posição e o pulo vêm da presença */
  standing: boolean; air: boolean; bounced: number; prev: THREE.Vector3;
  /** a reação mais recente, para uma mais antiga não desfazer uma nova ao terminar */
  reaction: number;
  /** as marcas desenhadas na etiqueta agora (e a chave que as resume, para não redesenhar à toa) */
  marks: LabelMarks; marksKey: string; botSuffix: string;
  /** as cartas desta cadeira estão levantadas (a pessoa olha para elas; um bot, enquanto pensa) */
  lifted: boolean;
}

const LABEL_COLOR = '#dae0da', LABEL_ON_COLOR = '#66ef73', TIP_COLOR = '#f2e9c8';
/** O que a etiqueta sobre a cabeça mostra além do nome: quem carteia (uma carta ao lado do nome) e por quem um bot joga. */
export interface LabelMarks { dealer: boolean; botControlled: boolean }
const LABEL_Y = BUDDY_HEIGHT + 0.12, BUBBLE_Y = BUDDY_HEIGHT + 0.34;

/** O boneco olha para +z; a cadeira olha para -z (a mesa): o boneco entra virado. */
function mount(buddy: Buddy, g: THREE.Group) { buddy.group.rotation.y = Math.PI; g.add(buddy.group); }

/** Boneco sentado na cadeira `seat`, com o molho de quem senta (`molhoKey`: o apelido que dá o molho, quando não é o nome mostrado). Origem no chão, sob o assento. */
export function makeCharacter(seat: Seat, name: string, bot: boolean, molhoKey = name): Character {
  const g = new THREE.Group();
  const buddy = createBuddy({ outfit: outfitFor(molhoKey, bot, 'OnTable') });
  buddy.setSeated(true);
  mount(buddy, g);
  const label = place(makeTextSprite(name, LABEL_COLOR), 0, LABEL_Y, 0); g.add(label);
  const labelOn = place(makeTextSprite(name, LABEL_ON_COLOR), 0, LABEL_Y, 0); labelOn.visible = false; g.add(labelOn);
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, toneMapped: false }));
  bubble.position.set(0, BUBBLE_Y, 0); bubble.scale.set(0.7, 0.175, 1); bubble.visible = false; g.add(bubble);
  g.position.copy(seatDir(seat).multiplyScalar(SEAT_R)); g.rotation.y = seatAngle(seat);
  return {
    seat, name, bot, molhoKey, g, buddy, label, labelOn, bubble, bubbleUntil: 0, talkUntil: 0, standing: false, air: false, bounced: 0, prev: g.position.clone(), reaction: 0,
    marks: { dealer: false, botControlled: false }, marksKey: '', botSuffix: 'bot', lifted: false,
  };
}

/** Quem senta na cadeira mudou: o nome sobre a cabeça e o molho seguem. */
export function nameCharacter(ch: Character, name: string, bot: boolean, molhoKey = name) {
  if (ch.name === name && ch.bot === bot && ch.molhoKey === molhoKey) return;
  ch.name = name; ch.bot = bot; ch.molhoKey = molhoKey;
  ch.buddy.setOutfit(outfitFor(molhoKey, bot, 'OnTable'));
  ch.marksKey = '';
  markCharacter(ch, ch.marks, ch.botSuffix);
}

/** As marcas da etiqueta (carteador, bot jogando pela pessoa) mudaram: redesenha só quando o texto muda. `botSuffix` é a palavra "bot" na língua da hora. */
export function markCharacter(ch: Character, marks: LabelMarks, botSuffix: string) {
  const key = `${ch.name}|${marks.dealer ? 'd' : ''}|${marks.botControlled ? 'b' : ''}|${botSuffix}`;
  if (key === ch.marksKey) return;
  ch.marksKey = key; ch.marks = { ...marks }; ch.botSuffix = botSuffix;
  const text = marks.botControlled ? `${ch.name} ·${botSuffix}` : ch.name;
  for (const [sprite, color] of [[ch.label, LABEL_COLOR], [ch.labelOn, LABEL_ON_COLOR]] as const) {
    const mat = sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose(); mat.map = textTexture(text, color, 40, 256, 64, marks.dealer); mat.needsUpdate = true;
  }
}

function canvasTexture(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/** Texto centrado com contorno; `deckBadge` desenha uma cartinha à esquerda do nome (a marca de quem carteia). O texto encolhe até caber. */
function textTexture(text: string, color: string, size = 40, w = 256, h = 64, deckBadge = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const badgeW = deckBadge ? 34 : 0, maxW = w - 16 - badgeW;
  let px = size; x.font = `bold ${px}px ${UI_FONT}`;
  while (px > 18 && x.measureText(text).width > maxW) { px -= 2; x.font = `bold ${px}px ${UI_FONT}`; }
  const tw = x.measureText(text).width, left = (w - tw - badgeW) / 2;
  if (deckBadge) {
    const bx = left, by = h / 2 - 15;
    x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(bx - 3, by - 3, 26, 36);
    x.fillStyle = '#f4efe2'; x.fillRect(bx, by, 20, 30);
    x.fillStyle = '#b3261e'; x.fillRect(bx + 3, by + 3, 14, 24);
    x.fillStyle = '#f4efe2'; x.fillRect(bx + 6, by + 6, 8, 18);
  }
  const cx = left + badgeW + tw / 2;
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(text, cx, h / 2); x.fillStyle = color; x.fillText(text, cx, h / 2);
  return canvasTexture(c);
}

export function makeTextSprite(text: string, color: string) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, color), transparent: true, depthTest: false, toneMapped: false }));
  sp.scale.set(0.5, 0.125, 1); return sp;
}

/** A dica sobre uma carta da mesa (quem jogou, em que vaza): um sprite só, que troca de texto quando a mira muda de carta. */
export interface Tip { sprite: THREE.Sprite; text: string }
export function makeTip(): Tip {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, toneMapped: false }));
  sprite.scale.set(0.42, 0.105, 1); sprite.visible = false;
  return { sprite, text: '' };
}
export function showTip(tip: Tip, text: string | null, at?: THREE.Vector3) {
  if (!text || !at) { tip.sprite.visible = false; return; }
  if (text !== tip.text) {
    tip.text = text;
    const mat = tip.sprite.material as THREE.SpriteMaterial;
    mat.map?.dispose(); mat.map = textTexture(text, TIP_COLOR, 34, 320, 64); mat.needsUpdate = true;
  }
  tip.sprite.position.copy(at).y += 0.11; tip.sprite.visible = true;
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

/* ---------- cartas ---------- */
/**
 * `known`: a pessoa sabe que carta é (vê a face); senão as duas faces mostram as costas. `face`/`back` vêm do cenário (`dressCards`).
 * `tp`/`tq` é onde a carta vai parar; `path` são os trechos que ela percorre até lá, no tempo (ver `tween.ts`).
 */
export interface CardData {
  tp: THREE.Vector3; tq: THREE.Quaternion; b: number; tb: number; known: boolean; front: THREE.Mesh; face: THREE.Texture | null; back: THREE.Texture | null;
  path: Segment[];
}
export type CardGroup = THREE.Group & { userData: CardData & { id: CardId } };

/** As 40 cartas físicas, ainda sem desenho: o cenário veste com `dressCards`. */
export function buildCards(): Record<CardId, CardGroup> {
  const out = {} as Record<CardId, CardGroup>;
  for (const id of makeDeck()) {
    const g = new THREE.Group() as CardGroup;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }));
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }));
    rear.rotation.y = Math.PI; front.castShadow = true;
    g.add(front, rear);
    g.userData = { id, tp: new THREE.Vector3(0.6, TABLE_TOP, -0.6), tq: new THREE.Quaternion(), b: 1, tb: 1, known: true, front, face: null, back: null, path: [] };
    g.position.copy(g.userData.tp);
    out[id] = g;
  }
  return out;
}

/** O baralho troca de desenho com o cenário: cada carta recebe a face e as costas dele, e o acabamento do papel. */
export function dressCards(cards: Record<CardId, CardGroup>, art: DeckArt) {
  for (const g of Object.values(cards)) {
    const d = g.userData;
    d.face = art.face(d.id); d.back = art.back;
    const [front, rear] = g.children as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>[];
    front.material.map = d.known ? d.face : d.back; front.material.roughness = art.roughness; front.material.metalness = art.metalness; front.material.needsUpdate = true;
    rear.material.map = d.back; rear.material.roughness = art.roughness; rear.material.metalness = art.metalness; rear.material.needsUpdate = true;
  }
}

/** Mostra a face de uma carta só a quem a conhece; para os outros, costas dos dois lados. */
export function showFace(card: CardGroup, known: boolean) {
  const d = card.userData;
  if (d.known === known) return;
  d.known = known;
  const m = d.front.material as THREE.MeshStandardMaterial;
  m.map = known ? d.face : d.back; m.needsUpdate = true;
}
