/**
 * Ferramentas dos cenários: sorteio semeado (o mesmo cenário em toda tela), texturas desenhadas em canvas
 * (null sem DOM, para os testes), formas curtas e a limpeza da GPU. Nada aqui sabe de um cenário específico.
 */
import type { Seat } from '@truco/rules';
import * as THREE from 'three';
import { seatAngle, seatDir, SEAT_R } from '../builders';
import { STOOL_H } from '../buddy/model';

/** Altura do assento de toda cadeira: o boneco senta aqui (as pernas saem por cima da borda). */
export const SEAT_H = STOOL_H;
/** O corpo do boneco sentado vai até ~0.43 atrás da origem da cadeira: o encosto começa daqui (z local). */
export const SEAT_BACK_Z = 0.46;
/** Raio, a partir da origem da cadeira, que conta como assento para quem anda (cobre o assento e o encosto). */
export const SEAT_FOOT_R = 0.55;

/** mulberry32: o mesmo cenário em toda tela. `rnd` em [0, 1), `rr(a, b)` em [a, b). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  return { rnd, rr, pick };
}
export type Rng = ReturnType<typeof seeded>;

export const polar = (r: number, a: number) => new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
export const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };
export function box(w: number, h: number, d: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m;
}
export function cyl(rt: number, rb: number, h: number, mat: THREE.Material, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = m.receiveShadow = true; return m;
}
export function sph(r: number, mat: THREE.Material, seg = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.75))), mat); m.castShadow = m.receiveShadow = true; return m;
}
/** Cápsula em pé (eixo y): raio `r`, `len` entre as calotas. */
export function capsule(r: number, len: number, mat: THREE.Material, seg = 10) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, seg), mat); m.castShadow = m.receiveShadow = true; return m;
}
/** Todo mesh da árvore projeta e recebe sombra (menos o que `skip` disser). */
export function shadows(root: THREE.Object3D, skip?: (o: THREE.Mesh) => boolean) {
  root.traverse((o) => { if (o instanceof THREE.Mesh && !(skip && skip(o))) o.castShadow = o.receiveShadow = true; });
}

/* ---------- canvas ---------- */
export const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function';
export type Draw = (x: CanvasRenderingContext2D, w: number, h: number) => void;
export interface TexOptions { repeat?: number | [number, number]; srgb?: boolean; anisotropy?: number }

/** Uma textura desenhada; null sem DOM. */
export function tex(w: number, h: number, draw: Draw, { repeat, srgb = true, anisotropy = 4 }: TexOptions = {}): THREE.CanvasTexture | null {
  if (!hasDom()) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== undefined) { t.wrapS = t.wrapT = THREE.RepeatWrapping; const [rx, ry] = typeof repeat === 'number' ? [repeat, repeat] : repeat; t.repeat.set(rx, ry); }
  t.anisotropy = anisotropy;
  return t;
}
/** Cor e relevo desenhados juntos da mesma lista de pedras, para o relevo bater com a pintura. */
export function pair(w: number, h: number, draw: (x: CanvasRenderingContext2D, bx: CanvasRenderingContext2D, w: number, h: number) => void, repeat: number) {
  if (!hasDom()) return { map: null, bump: null };
  const c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = b.width = w; c.height = b.height = h;
  draw(c.getContext('2d')!, b.getContext('2d')!, w, h);
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8; return t; };
  return { map: mk(c, true), bump: mk(b, false) };
}
export function speckle(x: CanvasRenderingContext2D, rng: Rng, w: number, h: number, n: number, cols: string[], rmin: number, rmax: number, amin = 0.12, amax = 0.4) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[Math.floor(rng.rnd() * cols.length)]; x.globalAlpha = rng.rr(amin, amax);
    x.beginPath(); x.arc(rng.rnd() * w, rng.rnd() * h, rng.rr(rmin, rmax), 0, 7); x.fill();
  }
  x.globalAlpha = 1;
}
export function roundRect(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
/** Um bloco de pedra pintado (`x`) e em relevo (`bx`): cinza `base` ± 14, com luz de cima à esquerda; `wet` mancha úmida às vezes. */
export function stoneBlock(x: CanvasRenderingContext2D, bx: CanvasRenderingContext2D, rng: Rng, l: number, t: number, w: number, h: number, r: number, base: number, wet: boolean) {
  const g = base + rng.rr(-14, 14);
  roundRect(x, l, t, w, h, r); x.fillStyle = `rgb(${g},${g},${g + 3})`; x.fill();
  const grad = x.createLinearGradient(l, t, l + w, t + h); grad.addColorStop(0, 'rgba(255,255,255,.14)'); grad.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = grad; roundRect(x, l, t, w, h, r); x.fill();
  if (wet && rng.rnd() < 0.35) { x.fillStyle = 'rgba(120,140,180,.18)'; roundRect(x, l + w * 0.15, t + h * 0.1, w * 0.6, h * 0.35, r); x.fill(); }
  const bg = bx.createRadialGradient(l + w / 2, t + h / 2, 2, l + w / 2, t + h / 2, Math.max(w, h) * 0.7); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.75, '#b0b0b0'); bg.addColorStop(1, '#202020');
  bx.fillStyle = bg; roundRect(bx, l, t, w, h, r); bx.fill();
}
/** Um brilho redondo (chama, lâmpada, lua): sprite com gradiente radial. */
export function radialSprite(rgb: string, a: number) {
  return tex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); });
}
export function glow(rgb: string, a: number, scale: number, fog = true) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite(rgb, a), transparent: true, depthWrite: false, fog }));
  sp.scale.setScalar(scale); return sp;
}
/** Céu: meia esfera vista por dentro, com um gradiente vertical; não recebe névoa. */
export function skyDome(stops: [number, string][], radius = 300) {
  const map = tex(4, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); for (const [p, c] of stops) g.addColorStop(p, c); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.05), new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false }));
  sky.position.y = -8; sky.name = 'sky'; return sky;
}

/* ---------- cadeiras ---------- */
/** Põe a cadeira de `seat` no lugar: origem no chão sob o assento, a mesa em -z local, o encosto em +z. */
export function placeChair(g: THREE.Group, seat: Seat) {
  g.name = 'chair'; g.position.copy(seatDir(seat).multiplyScalar(SEAT_R)); g.rotation.y = seatAngle(seat); return g;
}

/* ---------- limpeza ---------- */
/** Solta tudo o que a árvore guardava na GPU: geometrias, materiais e as texturas deles. */
export function disposeTree(root: THREE.Object3D) {
  const mats = new Set<THREE.Material>(), geos = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !(o instanceof THREE.Sprite)) geos.add(m.geometry);   // todo Sprite divide uma geometria global
    if (m.material) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
  });
  for (const g of geos) g.dispose();
  for (const m of mats) { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); }
}
