/**
 * Cemitério: uma noite gótica sob a lua de sangue. Mesa de madeira com veludo e velas, um lustre de ferro
 * pendurado numa forca, lápides, criptas, árvores mortas, lampiões, a grade de ferro, a cidade e a catedral
 * ao fundo, corvos e a névoa do chão. Tudo em código, sorteado de uma semente só (ADR 0007).
 */
import { SUITS, type CardId, type Seat, type Suit } from '@truco/rules';
import * as THREE from 'three';
import { TABLE_R, TABLE_TOP } from '../builders';
import { at, box, cyl, disposeTree, glow, pair, placeChair, polar, radialSprite, roundRect, SEAT_BACK_Z, SEAT_H, seeded, shadows, skyDome, speckle, stoneBlock, tex, type Rng } from './kit';
import type { DeckArt, SceneryBuilder } from './scenery';

const FENCE_R = 7, FOG = 0x140a10;
const SERIF = 'Georgia, "Times New Roman", serif';
const COPPER = '#c8783a', COPPER_DIM = 'rgba(200,120,58,.55)';
const COURT: Partial<Record<string, string>> = { J: 'HUNTER', Q: 'CHURCH', K: 'BEAST', A: 'BLOOD' };
const MANILHA_NAME: Partial<Record<CardId, string>> = { '4c': 'ZAP', '7h': 'SETE COPAS', As: 'ESPADILHA', '7d': 'SETE OUROS' };

/** Uma chama (vela, lustre): a bolinha, o brilho e a fase do tremor. */
interface Flame { flame: THREE.Mesh; halo: THREE.Sprite; phase: number }
/** Uma luz que treme: a luz, a intensidade de base, a fase e as chamas que ela acende. */
interface Flicker { light: THREE.PointLight; base: number; phase: number; flames: Flame[]; slow?: boolean }
interface Crow { g: THREE.Group; wings: THREE.Mesh[]; cx: number; cz: number; r: number; h: number; speed: number; phase: number; flap: number }
interface Puff { sp: THREE.Sprite; vx: number; vz: number; ph: number }

/* ---------- texturas ---------- */
function textures(rng: Rng) {
  const { rr, rnd } = rng;
  // pedras molhadas: irregulares, arredondadas, sobre argamassa escura
  const cobble = pair(1024, 1024, (x, bx, w, h) => {
    x.fillStyle = '#121213'; x.fillRect(0, 0, w, h); bx.fillStyle = '#000'; bx.fillRect(0, 0, w, h);
    const cols = 14, rows = 18, cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const sw = cw * rr(0.72, 0.92), sh = ch * rr(0.68, 0.9), l = i * cw + (cw - sw) / 2 + rr(-3, 3) + (j % 2 ? cw / 2 : 0), t = j * ch + (ch - sh) / 2 + rr(-3, 3);
      for (const dx of [0, -w]) stoneBlock(x, bx, rng, l + dx, t, sw, sh, Math.min(sw, sh) * 0.35, 66, true);
    }
    x.globalAlpha = 0.5; speckle(x, rng, w, h, 1200, ['#1b2418', '#26301e', '#0e0f10'], 2, 9, 0.15, 0.5); x.globalAlpha = 1;
  }, 2.2);
  // blocos de cantaria em fiadas desencontradas
  const ashlar = pair(512, 512, (x, bx, w, h) => {
    x.fillStyle = '#1c1c1e'; x.fillRect(0, 0, w, h); bx.fillStyle = '#000'; bx.fillRect(0, 0, w, h);
    const rows = 8, ch = h / rows;
    for (let j = 0; j < rows; j++) { let l = j % 2 ? -rr(20, 60) : 0; while (l < w) { const bw = rr(70, 150); for (const dx of [0, -w, w]) stoneBlock(x, bx, rng, l + dx + 3, j * ch + 3, bw - 6, ch - 6, 4, 92, false); l += bw; } }
    speckle(x, rng, w, h, 700, ['#2a3324', '#3a3a34', '#0f0f10', '#4a4a44'], 2, 16, 0.08, 0.3);
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1.2;
    for (let i = 0; i < 12; i++) { x.beginPath(); let px = rnd() * w, py = rnd() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rr(-28, 28); py += rr(-28, 28); x.lineTo(px, py); } x.stroke(); }
  }, 1);
  const ground = tex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#15170f'; x.fillRect(0, 0, w, h);
    speckle(x, rng, w, h, 5000, ['#1d2215', '#10130c', '#262a18', '#191c14', '#2b2819', '#0c0f0a', '#2f3a22'], 3, 26);
    x.lineWidth = 1.4;
    for (let i = 0; i < 2600; i++) { const px = rnd() * w, py = rnd() * h, len = rr(6, 18), a = rr(-0.5, 0.5); x.strokeStyle = `rgba(${40 + rnd() * 40},${55 + rnd() * 45},${25 + rnd() * 20},${rr(0.25, 0.6)})`; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.sin(a) * len, py - Math.cos(a) * len); x.stroke(); }
    speckle(x, rng, w, h, 900, ['#3a3a30', '#2a2d22', '#4a4436'], 1, 2.5, 0.3, 0.6);
  }, { repeat: 40 });
  const wood = tex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#24140c'; x.fillRect(0, 0, w, h);
    const planks = 6, pw = w / planks;
    for (let p = 0; p < planks; p++) {
      const tone = rr(-12, 12);
      for (let y = 0; y < h; y += 2) { const a = 0.08 + 0.3 * Math.abs(Math.sin(y * 0.09 + Math.sin(y * 0.017 + p) * 4 + p * 7)); x.fillStyle = `rgba(${12 + tone},${6 + tone / 2},2,${a})`; x.fillRect(p * pw, y, pw, 2); }
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(p * pw, 0, 3, h);
      x.fillStyle = 'rgba(255,200,150,.05)'; x.fillRect(p * pw + 3, 0, 2, h);
    }
    speckle(x, rng, w, h, 900, ['#3a2416', '#1c1008', '#4a2c18', '#5a3a20'], 4, 50, 0.05, 0.16);
  }, { repeat: 1 });
  const velvet = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#3a0f14'; x.fillRect(0, 0, w, h);
    speckle(x, rng, w, h, 4000, ['#4a141a', '#2a080c', '#521820', '#300a0e'], 2, 10, 0.1, 0.3);
    x.strokeStyle = 'rgba(201,150,90,.16)'; x.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { x.beginPath(); x.moveTo(i * 85 + 42, j * 85); x.lineTo(i * 85 + 85, j * 85 + 42); x.lineTo(i * 85 + 42, j * 85 + 85); x.lineTo(i * 85, j * 85 + 42); x.closePath(); x.stroke(); }
  }, { repeat: 2 });
  // fachada: tijolo escuro com janelas em arco, umas poucas acesas (as mesmas na cor e na emissão)
  const lit: boolean[] = []; for (let i = 0; i < 64; i++) lit.push(rnd() < 0.09);
  const arch = (c: CanvasRenderingContext2D, px: number, py: number) => { c.beginPath(); c.moveTo(px, py + 38); c.lineTo(px, py + 12); c.arc(px + 12, py + 12, 12, Math.PI, 0); c.lineTo(px + 24, py + 38); c.closePath(); c.fill(); };
  const facadeMap = tex(512, 512, (x) => {
    x.fillStyle = '#17161b'; x.fillRect(0, 0, 512, 512);
    for (let j = 0; j < 16; j++) { let l = j % 2 ? -20 : 0; while (l < 512) { const bw = rr(40, 90), g = 26 + rr(-6, 8); x.fillStyle = `rgb(${g},${g},${g + 4})`; x.fillRect(l + 1.5, j * 32 + 1.5, bw - 3, 29); l += bw; } }
    speckle(x, rng, 512, 512, 600, ['#0d0d10', '#2a2830', '#1e2a22'], 3, 22, 0.08, 0.3);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const px = i * 64 + 20, py = j * 64 + 12;
      x.fillStyle = '#0a0a0d'; x.fillRect(px - 3, py - 3, 30, 44);
      x.fillStyle = lit[j * 8 + i] ? '#ffb45a' : '#050507'; arch(x, px, py);
    }
  }, { repeat: 1 });
  const facadeGlow = tex(512, 512, (ex) => {
    ex.fillStyle = '#000'; ex.fillRect(0, 0, 512, 512); ex.fillStyle = '#ffb45a';
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (lit[j * 8 + i]) arch(ex, i * 64 + 20, j * 64 + 12);
  }, { repeat: 1 });
  return { cobble, ashlar, ground, wood, velvet, facadeMap, facadeGlow };
}

/* ---------- baralho: papel preto, filigrana de cobre, face de pergaminho, sangue nas manilhas ---------- */
function filigree(x: CanvasRenderingContext2D, l: number, t: number, w: number, h: number, step = 22) {
  x.strokeStyle = COPPER_DIM; x.lineWidth = 1.6;
  for (let i = l + step / 2; i < l + w; i += step) { x.beginPath(); x.arc(i, t, step / 2 - 2, 0, Math.PI); x.stroke(); x.beginPath(); x.arc(i, t + h, step / 2 - 2, Math.PI, 0); x.stroke(); }
  for (let j = t + step / 2; j < t + h; j += step) { x.beginPath(); x.arc(l, j, step / 2 - 2, -Math.PI / 2, Math.PI / 2); x.stroke(); x.beginPath(); x.arc(l + w, j, step / 2 - 2, Math.PI / 2, -Math.PI / 2); x.stroke(); }
}
function cornerFlourish(x: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number) {
  x.strokeStyle = COPPER; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy + sy * 34); x.quadraticCurveTo(cx, cy, cx + sx * 34, cy); x.stroke();
  x.beginPath(); x.arc(cx + sx * 12, cy + sy * 12, 5, 0, 7); x.stroke();
  x.fillStyle = COPPER; x.beginPath(); x.arc(cx + sx * 40, cy + sy * 4, 2.2, 0, 7); x.fill(); x.beginPath(); x.arc(cx + sx * 4, cy + sy * 40, 2.2, 0, 7); x.fill();
}
function spatter(x: CanvasRenderingContext2D, rng: Rng, n: number, cx: number, cy: number, spread: number) {
  for (let i = 0; i < n; i++) {
    const px = cx + rng.rr(-spread, spread), py = cy + rng.rr(-spread, spread), r = rng.rr(1, 7);
    x.fillStyle = `rgba(${110 + rng.rnd() * 40},${8 + rng.rnd() * 10},${14 + rng.rnd() * 10},${rng.rr(0.35, 0.85)})`;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
    if (rng.rnd() < 0.3) x.fillRect(px - r * 0.3, py, r * 0.6, rng.rr(6, 30));
  }
}
/** A marca de três pontas do caçador. */
function sigil(x: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  x.strokeStyle = COPPER; x.lineWidth = s * 0.09; x.lineCap = 'round';
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 3; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s); x.stroke(); x.beginPath(); x.arc(cx + Math.cos(a) * s * 0.7, cy + Math.sin(a) * s * 0.7, s * 0.22, a + Math.PI / 2, a - Math.PI / 2); x.stroke(); }
  x.beginPath(); x.arc(cx, cy, s * 0.18, 0, 7); x.stroke(); x.lineCap = 'butt';
}
function deckArt(rng: Rng): DeckArt {
  const back = tex(256, 364, (x) => {
    x.fillStyle = '#0a0809'; roundRect(x, 0, 0, 256, 364, 18); x.fill();
    const vg = x.createRadialGradient(128, 182, 40, 128, 182, 230); vg.addColorStop(0, 'rgba(70,14,20,.85)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = vg; x.fillRect(0, 0, 256, 364);
    x.strokeStyle = COPPER; x.lineWidth = 2.5; roundRect(x, 12, 12, 232, 340, 10); x.stroke();
    x.lineWidth = 1; roundRect(x, 20, 20, 216, 324, 8); x.stroke();
    filigree(x, 32, 32, 192, 300, 20);
    for (const [sx, sy, cx, cy] of [[1, 1, 26, 26], [-1, 1, 230, 26], [1, -1, 26, 338], [-1, -1, 230, 338]]) cornerFlourish(x, cx, cy, sx, sy);
    x.strokeStyle = COPPER; x.lineWidth = 2; x.beginPath(); x.arc(128, 182, 62, 0, 7); x.stroke(); x.lineWidth = 1; x.beginPath(); x.arc(128, 182, 70, 0, 7); x.stroke();
    x.fillStyle = 'rgba(120,20,26,.7)'; x.beginPath(); x.arc(128, 182, 58, 0, 7); x.fill();
    sigil(x, 128, 182, 44);
    spatter(x, rng, 14, 128, 182, 120);
  });
  const faces = new Map<CardId, THREE.Texture | null>();
  const face = (id: CardId) => {
    const done = faces.get(id); if (done !== undefined) return done;
    const rank = id[0], suit = id[1] as Suit, manilha = MANILHA_NAME[id];
    const t = tex(256, 364, (x) => {
      const red = suit === 'h' || suit === 'd', col = red ? '#8a1a1e' : '#1a1512';
      x.fillStyle = '#0a0809'; roundRect(x, 0, 0, 256, 364, 18); x.fill();
      x.fillStyle = '#d8c9a4'; roundRect(x, 10, 10, 236, 344, 12); x.fill();
      speckle(x, rng, 256, 364, 260, ['#b9a27a', '#e6dcbf', '#a08a62'], 3, 30, 0.08, 0.22);
      const vg = x.createRadialGradient(128, 182, 60, 128, 182, 260); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,30,10,.55)'); x.fillStyle = vg; roundRect(x, 10, 10, 236, 344, 12); x.fill();
      x.strokeStyle = COPPER; x.lineWidth = 2; roundRect(x, 18, 18, 220, 328, 8); x.stroke();
      if (manilha) { x.strokeStyle = '#7a0c14'; x.lineWidth = 7; roundRect(x, 13, 13, 230, 338, 10); x.stroke(); x.strokeStyle = COPPER; x.lineWidth = 1.5; roundRect(x, 24, 24, 208, 316, 6); x.stroke(); }
      filigree(x, 30, 30, 196, 304, 20);
      for (const [sx, sy, cx, cy] of [[1, 1, 24, 24], [-1, 1, 232, 24], [1, -1, 24, 340], [-1, -1, 232, 340]]) cornerFlourish(x, cx, cy, sx, sy);
      const vg2 = x.createRadialGradient(128, 182, 10, 128, 182, 90); vg2.addColorStop(0, 'rgba(40,6,10,.55)'); vg2.addColorStop(1, 'rgba(40,6,10,0)'); x.fillStyle = vg2; x.fillRect(0, 0, 256, 364);
      if (manilha) {
        // sangue pesado: poças, escorridos e borrifo fino, longe dos cantos com o valor
        for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(${120 + rng.rnd() * 40},${8 + rng.rnd() * 12},${14 + rng.rnd() * 10},${rng.rr(0.7, 0.92)})`; x.beginPath(); x.arc(rng.rr(60, 200), rng.rr(110, 330), rng.rr(8, 22), 0, 7); x.fill(); }
        for (let i = 0; i < 7; i++) { const px = rng.rr(50, 206), py = rng.rr(40, 150), len = rng.rr(50, 170); x.fillStyle = `rgba(130,10,16,${rng.rr(0.7, 0.9)})`; x.fillRect(px - 2, py, 4, len); x.beginPath(); x.arc(px, py + len, 4.5, 0, 7); x.fill(); x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill(); }
        spatter(x, rng, 70, 128, 200, 110); spatter(x, rng, 40, 128, 320, 90);
      }
      x.fillStyle = col; x.textBaseline = 'top'; x.textAlign = 'left';
      x.font = `600 58px ${SERIF}`; x.fillText(rank, 26, 22); x.font = '44px serif'; x.fillText(SUITS[suit], 28, 82);
      x.save(); x.translate(256, 364); x.rotate(Math.PI); x.font = `600 58px ${SERIF}`; x.fillText(rank, 26, 22); x.font = '44px serif'; x.fillText(SUITS[suit], 28, 82); x.restore();
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = col; x.shadowColor = manilha ? 'rgba(216,201,164,.95)' : 'rgba(0,0,0,.5)'; x.shadowBlur = manilha ? 14 : 6; x.font = '140px serif'; x.fillText(SUITS[suit], 128, 178); if (manilha) x.fillText(SUITS[suit], 128, 178); x.shadowBlur = 0;
      const title = manilha ?? COURT[rank];
      if (title) { x.fillStyle = manilha ? '#5a0a10' : COPPER; x.shadowColor = 'rgba(216,201,164,.95)'; x.shadowBlur = manilha ? 8 : 0; x.font = `600 ${manilha ? 22 : 20}px ${SERIF}`; x.fillText(title, 128, 292); x.shadowBlur = 0; x.fillStyle = COPPER; x.fillRect(80, 306, 96, 1); }
      if (!manilha) spatter(x, rng, red ? 12 : 7, rng.rr(60, 200), rng.rr(60, 300), 70);
    });
    faces.set(id, t);
    return t;
  };
  return { face, back, roughness: 0.65, metalness: 0.15, dispose() { back?.dispose(); for (const f of faces.values()) f?.dispose(); faces.clear(); } };
}

/* ---------- cenário ---------- */
export const buildGraveyard: SceneryBuilder = () => {
  const rng = seeded(1337), { rnd, rr } = rng;
  const T = textures(rng);
  const group = new THREE.Group(); group.name = 'graveyard';
  const flickers: Flicker[] = [], crows: Crow[] = [], puffs: Puff[] = [];
  const extraMats: THREE.Material[] = [];

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x25201c, roughness: 1 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5, metalness: 0.75 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: T.ashlar.map, bumpMap: T.ashlar.bump, bumpScale: 0.6, color: 0x8a8a86, roughness: 0.9 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ map: T.ashlar.map, bumpMap: T.ashlar.bump, bumpScale: 0.6, color: 0x55555a, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ map: T.wood, roughness: 0.55, metalness: 0.05 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.9 });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff9a3c, emissiveIntensity: 2.2, roughness: 0.4 });
  const facade = new THREE.MeshStandardMaterial({ map: T.facadeMap, emissiveMap: T.facadeGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.95 });
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc4, roughness: 0.7 });
  const holderMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.4, metalness: 0.7 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const haloTex = radialSprite('255,170,80', 0.5);

  /* ---------- céu, lua, estrelas, chão ---------- */
  {
    group.add(skyDome([[0, '#05040a'], [0.5, '#160a14'], [0.85, '#2a0f18'], [1, '#140a10']]));
    const pts: number[] = []; for (let i = 0; i < 700; i++) { const a = rnd() * 6.283, e = rr(0.06, 1.4), r = 280; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x9fa6c0, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }); extraMats.push(starMat);
    group.add(new THREE.Points(sg, starMat));
    const moonDir = new THREE.Vector3(-0.38, 0.42, -0.82).normalize();
    const moonTex = tex(512, 512, (x) => {
      const g = x.createRadialGradient(200, 190, 20, 256, 256, 256); g.addColorStop(0, '#ff5a3a'); g.addColorStop(0.55, '#c8201c'); g.addColorStop(1, '#7a0c12');
      x.fillStyle = g; x.beginPath(); x.arc(256, 256, 256, 0, 7); x.fill();
      for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(60,0,10,${rr(0.15, 0.4)})`; x.beginPath(); x.arc(rr(60, 450), rr(60, 450), rr(10, 55), 0, 7); x.fill(); }
    });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(13, 64), new THREE.MeshBasicMaterial({ map: moonTex, fog: false, transparent: true }));
    moon.position.copy(moonDir).multiplyScalar(160); moon.lookAt(0, 1, 0); group.add(moon);
    const moonGlow = glow('220,40,30', 0.7, 80, false); moonGlow.position.copy(moonDir).multiplyScalar(158); group.add(moonGlow);
    const moonHalo = glow('140,20,40', 0.35, 240, false); moonHalo.position.copy(moonDir).multiplyScalar(156); group.add(moonHalo);
    extraMats.push(moonGlow.material, moonHalo.material);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: T.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
    const flagMat = new THREE.MeshStandardMaterial({ map: T.cobble.map, bumpMap: T.cobble.bump, bumpScale: 0.9, roughness: 0.45, metalness: 0.05 });
    const flags = new THREE.Mesh(new THREE.CircleGeometry(3, 48), flagMat);
    flags.rotation.x = -Math.PI / 2; flags.position.y = 0.01; flags.receiveShadow = true; group.add(flags);
    // o caminho até o portão, na frente da cadeira 0, com as pedras esticadas ao longo dele
    const pathMat = flagMat.clone();
    if (T.cobble.map && T.cobble.bump) { pathMat.map = T.cobble.map.clone(); pathMat.map.repeat.set(0.6, 2); pathMat.bumpMap = T.cobble.bump.clone(); pathMat.bumpMap.repeat.set(0.6, 2); }
    const path = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 5.5), pathMat);
    path.rotation.x = -Math.PI / 2; path.position.set(0, 0.008, -5.2); path.receiveShadow = true; group.add(path);

    group.add(new THREE.HemisphereLight(0x4a2230, 0x0a0908, 0.6));
    const moonLight = new THREE.DirectionalLight(0xc4483e, 1.3);
    moonLight.position.copy(moonDir).multiplyScalar(40); moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048); moonLight.shadow.bias = -0.0008; moonLight.shadow.normalBias = 0.02;
    const sc = moonLight.shadow.camera; sc.left = sc.bottom = -11; sc.right = sc.top = 11; sc.near = 10; sc.far = 80;
    group.add(moonLight, moonLight.target);
  }

  /* ---------- mesa ---------- */
  {
    const top = cyl(TABLE_R, TABLE_R, 0.07, woodMat, 64); top.position.y = TABLE_TOP - 0.035; group.add(top);
    const felt = new THREE.Mesh(new THREE.CircleGeometry(TABLE_R - 0.12, 64), new THREE.MeshStandardMaterial({ map: T.velvet, roughness: 1 }));
    felt.rotation.x = -Math.PI / 2; felt.position.y = TABLE_TOP + 0.001; felt.receiveShadow = true; group.add(felt);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R - 0.005, 0.03, 10, 64), new THREE.MeshStandardMaterial({ color: 0x7a6236, roughness: 0.4, metalness: 0.6 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = TABLE_TOP - 0.01; group.add(rim);
    const stem = cyl(0.11, 0.16, 0.6, woodMat, 16); stem.position.y = 0.38; group.add(stem);
    const foot = cyl(0.42, 0.5, 0.09, woodMat, 24); foot.position.y = 0.045; group.add(foot);
    for (let i = 0; i < 3; i++) { const claw = box(0.16, 0.12, 0.55, woodMat); claw.position.copy(polar(0.42, i * 2.094)).setY(0.06); claw.rotation.y = i * 2.094; group.add(claw); }
  }

  /* ---------- velas na beira, entre as cadeiras, e o lustre pendurado na forca ---------- */
  const flame = (parent: THREE.Object3D, y: number, r: number, halo: number, phase: number): Flame => {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), flameMat); fl.scale.y = 2; fl.position.y = y; parent.add(fl);
    const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false })); hl.scale.setScalar(halo); hl.position.y = y + 0.01; parent.add(hl);
    extraMats.push(hl.material);
    return { flame: fl, halo: hl, phase };
  };
  {
    [Math.PI / 4, Math.PI * 5 / 4, Math.PI * 7 / 4].forEach((a, i) => {
      const g = new THREE.Group(); g.position.copy(polar(0.98, a)).setY(TABLE_TOP);
      const h = [0.16, 0.1, 0.13][i];
      g.add(at(cyl(0.05, 0.065, 0.03, holderMat, 16), 0, 0.015, 0));
      const wax = cyl(0.02, 0.022, h, waxMat, 12); wax.position.y = 0.03 + h / 2; g.add(wax);
      const light = new THREE.PointLight(0xffa552, 1.1, 3.5, 2); light.position.y = 0.03 + h + 0.08; g.add(light);
      flickers.push({ light, base: 1.1, phase: i * 2.1, flames: [flame(g, 0.03 + h + 0.02, 0.013, 0.22, i * 2.1)] });
      group.add(g);
    });
    const postP = polar(2.9, Math.PI / 4 * 3 + 0.2);
    group.add(at(cyl(0.06, 0.09, 4.4, ironMat, 10), postP.x, 2.2, postP.z), at(cyl(0.22, 0.28, 0.14, ironMat, 10), postP.x, 0.07, postP.z));
    const beam = box(0.09, 0.12, postP.length() + 0.1, ironMat); beam.position.set(postP.x / 2, 4.35, postP.z / 2); beam.rotation.y = Math.atan2(postP.x, postP.z); group.add(beam);
    const brace = box(0.05, 0.05, 1.5, ironMat); brace.position.set(postP.x * 0.78, 3.85, postP.z * 0.78); brace.rotation.y = beam.rotation.y; brace.rotation.x = -0.75; group.add(brace);
    group.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), ironMat), 0, 4.26, 0));
    const chandelier = new THREE.Group(); chandelier.position.y = 2.75; group.add(chandelier);
    for (let k = 0; k < 8; k++) { const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.01, 6, 12), ironMat); link.position.y = 1.5 - k * 0.17; link.rotation.y = k % 2 ? Math.PI / 2 : 0; chandelier.add(link); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 8, 48), ironMat); ring.rotation.x = Math.PI / 2; ring.castShadow = true; chandelier.add(ring);
    chandelier.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), ironMat), 0, 0.05, 0));
    for (let k = 0; k < 4; k++) { const spoke = box(0.02, 0.02, 1.0, ironMat); spoke.rotation.y = k * Math.PI / 4; spoke.position.y = 0.05; chandelier.add(spoke); }
    const flames: Flame[] = [];
    for (let k = 0; k < 8; k++) {
      const p = polar(0.5, k / 8 * Math.PI * 2), c = new THREE.Group(); c.position.set(p.x, 0, p.z);
      c.add(at(cyl(0.035, 0.02, 0.04, holderMat, 8), 0, 0.03, 0), at(cyl(0.014, 0.016, 0.12, waxMat, 8), 0, 0.11, 0));
      flames.push(flame(c, 0.19, 0.011, 0.2, k * 1.7)); chandelier.add(c);
    }
    const light = new THREE.PointLight(0xffa552, 3.2, 8, 2); light.position.y = 0.25; chandelier.add(light);
    flickers.push({ light, base: 3.2, phase: 0.7, flames });
  }

  /* ---------- cadeiras góticas baixas: assento na altura de sempre, encosto em ogiva ---------- */
  const chairs: THREE.Group[] = [];
  {
    const arch = new THREE.Shape();
    arch.moveTo(-0.24, 0); arch.lineTo(-0.24, 0.42); arch.quadraticCurveTo(-0.22, 0.62, 0, 0.7); arch.quadraticCurveTo(0.22, 0.62, 0.24, 0.42); arch.lineTo(0.24, 0); arch.closePath();
    const slit = new THREE.Path(); slit.moveTo(-0.05, 0.18); slit.lineTo(-0.05, 0.4); slit.quadraticCurveTo(-0.04, 0.5, 0, 0.53); slit.quadraticCurveTo(0.04, 0.5, 0.05, 0.4); slit.lineTo(0.05, 0.18); slit.closePath();
    arch.holes.push(slit);
    const backGeo = new THREE.ExtrudeGeometry(arch, { depth: 0.04, bevelEnabled: false });
    for (let s = 0; s < 4; s++) {
      const g = new THREE.Group();
      // o corpo do boneco sentado tem ~0.43 de raio a partir da origem: o encosto fica atrás disso (z ≥ SEAT_BACK_Z)
      const seat = box(0.5, 0.04, 0.5, woodMat); seat.name = 'seat'; seat.position.set(0, SEAT_H - 0.02, 0.2); g.add(seat);
      for (const [x, z] of [[-0.21, -0.02], [0.21, -0.02], [-0.21, 0.42], [0.21, 0.42]]) g.add(at(box(0.045, SEAT_H - 0.04, 0.045, ironMat), x, (SEAT_H - 0.04) / 2, z));
      const back = new THREE.Mesh(backGeo, woodMat); back.position.set(0, SEAT_H, SEAT_BACK_Z); back.castShadow = back.receiveShadow = true; g.add(back);
      for (const x of [-0.21, 0.21]) { const post = cyl(0.02, 0.025, 0.72, ironMat, 8); post.position.set(x, SEAT_H + 0.36, SEAT_BACK_Z + 0.03); g.add(post); const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), ironMat); fin.position.set(x, SEAT_H + 0.76, SEAT_BACK_Z + 0.03); fin.castShadow = true; g.add(fin); }
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), ironMat); tip.position.set(0, SEAT_H + 0.74, SEAT_BACK_Z + 0.02); tip.castShadow = true; g.add(tip);
      placeChair(g, s as Seat); chairs.push(g); group.add(g);
    }
  }

  /* ---------- cemitério ---------- */
  const yard = new THREE.Group(); group.add(yard);
  const lanternLights: Flicker[] = [];
  function gravestone(type: number, scale = 1) {
    const g = new THREE.Group();
    const mat = rnd() < 0.5 ? stoneMat : darkStoneMat;
    if (type === 0) {
      const w = rr(0.45, 0.65) * scale, h = rr(0.7, 1.0) * scale, sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), mat); m.position.z = -0.06; g.add(m);
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.1, 0.4), mat), 0, 0.05, 0));
    } else if (type === 1) {
      const h = rr(1.1, 1.6) * scale;
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.14), mat), 0, h / 2, 0), at(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.14), mat), 0, h * 0.72, 0), at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), mat), 0, 0.07, 0));
    } else {
      const h = rr(1.2, 2.0) * scale;
      g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.6), mat), 0, 0.125, 0), at(new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), mat), 0, 0.25 + h / 2, 0));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 4), mat); tip.rotation.y = Math.PI / 4; tip.position.y = 0.25 + h + 0.2; g.add(tip);
    }
    shadows(g);
    g.rotation.set(rr(-0.08, 0.08), rr(0, 6.28), rr(-0.1, 0.1));
    return g;
  }
  function crypt() {
    const g = new THREE.Group(), w = 2.0, h = 2.2, d = 2.6;
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkStoneMat), 0, h / 2, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 0.8, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set((w / 2 + 0.15) / 0.707, 1, (d / 2 + 0.15) / 0.707); roof.position.y = h + 0.4; g.add(roof);
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.5), new THREE.MeshBasicMaterial({ color: 0x030304 })), 0, 0.75, d / 2 + 0.002));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.2), stoneMat), 0, 1.6, d / 2 + 0.05));
    for (const x of [-0.55, 0.55]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), stoneMat), x, 0.8, d / 2 + 0.05));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), ironMat), 0, h + 1.0, 0), at(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.08), ironMat), 0, h + 1.12, 0));
    shadows(g);
    return g;
  }
  function branch(parent: THREE.Object3D, len: number, r: number, depth: number) {
    const geo = new THREE.CylinderGeometry(r * 0.5, r, len, 6); geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, barkMat); m.castShadow = true; parent.add(m);
    if (depth === 0) return;
    const n = depth >= 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Group(); b.position.y = len * rr(0.55, 1);
      b.rotation.set(rr(0.45, 0.95) * (rnd() < 0.5 ? 1 : -1), rr(0, 6.28), rr(0.45, 0.95) * (rnd() < 0.5 ? 1 : -1));
      m.add(b); branch(b, len * rr(0.55, 0.7), r * 0.55, depth - 1);
    }
  }
  const deadTree = (h: number) => { const g = new THREE.Group(); branch(g, h, h * 0.08, 3); g.rotation.y = rnd() * 6.28; return g; };
  function lantern(lit: boolean) {
    const g = new THREE.Group();
    g.add(at(cyl(0.035, 0.05, 2.7, ironMat, 10), 0, 1.35, 0), at(cyl(0.16, 0.2, 0.12, ironMat, 10), 0, 0.06, 0));
    const head = new THREE.Group(); head.position.y = 2.85;
    head.add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), glowMat));
    for (const [x, z] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) head.add(at(box(0.03, 0.36, 0.03, ironMat), x, 0, z));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), ironMat); cap.rotation.y = Math.PI / 4; cap.position.y = 0.27; cap.castShadow = true; head.add(cap);
    head.add(at(box(0.3, 0.03, 0.3, ironMat), 0, -0.18, 0));
    const halo = glow('255,160,70', 0.45, 1.3); head.add(halo); extraMats.push(halo.material);
    g.add(head);
    if (lit) { const l = new THREE.PointLight(0xff9d45, 2.4, 9, 2); l.position.y = 2.85; g.add(l); lanternLights.push({ light: l, base: 2.4, phase: rnd() * 6, flames: [], slow: true }); }
    return g;
  }
  {
    const taken: [number, number, number][] = [];
    const free = (x: number, z: number, r: number) => Math.hypot(x, z) > 3.2 && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > r + tr);
    const put = (obj: THREE.Object3D, r: number, a: number, keep: number) => { const p = polar(r, a); obj.position.set(p.x, 0, p.z); yard.add(obj); taken.push([p.x, p.z, keep]); return obj; };
    // criptas, árvores e lampiões primeiro: reservam espaço
    put(crypt(), 5.6, 2.35, 1.8).rotation.y = 2.35 + Math.PI; put(crypt(), 5.7, -2.2, 1.8).rotation.y = -2.2 + Math.PI;
    put(deadTree(4.2), 5.4, 0.55, 0.9); put(deadTree(3.6), 5.2, -1.05, 0.9); put(deadTree(4.6), 6.0, 3.6, 0.9);
    for (let k = 0; k < 4; k++) put(lantern(true), 3.6, Math.PI / 4 + k * Math.PI / 2, 0.4);
    let tries = 0;
    while (taken.length < 44 && tries++ < 600) {
      const r = rr(3.5, 6.4), a = rnd() * 6.283, p = polar(r, a);
      if (!free(p.x, p.z, 0.6)) continue;
      put(gravestone(rnd() < 0.55 ? 0 : rnd() < 0.5 ? 1 : 2), r, a, 0.5);
    }
    // além da grade: pedras e árvores mais ralas, sumindo na cidade
    for (let i = 0; i < 26; i++) { const r = rr(8, 13), a = rnd() * 6.283; put(gravestone(rnd() < 0.6 ? 0 : 2, rr(0.9, 1.4)), r, a, 0.5); }
    for (let i = 0; i < 5; i++) put(deadTree(rr(4, 6)), rr(8.5, 12), rnd() * 6.283, 1);
  }
  /* ---------- grade de ferro com o portão na frente da cadeira 0 ---------- */
  {
    const posts = 22, bars = 11, barGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.55, 6), finGeo = new THREE.ConeGeometry(0.035, 0.12, 6);
    const barMesh = new THREE.InstancedMesh(barGeo, ironMat, posts * bars), finMesh = new THREE.InstancedMesh(finGeo, ironMat, posts * bars);
    const M = new THREE.Matrix4(); let k = 0;
    // os mourões ficam meio vão fora do eixo, para o vão do portão (sem barras) ficar centrado em π, no caminho
    const ang = (i: number) => (i + 0.5) / posts * 6.2832, gateSeg = Math.round(posts / 2) - 1;
    for (let i = 0; i < posts; i++) {
      const a0 = ang(i), a1 = ang(i + 1);
      if (i !== gateSeg) for (let b = 1; b <= bars; b++) {
        const a = a0 + (a1 - a0) * b / (bars + 1), p = polar(FENCE_R, a);
        M.makeTranslation(p.x, 0.85, p.z); barMesh.setMatrixAt(k, M);
        M.makeTranslation(p.x, 1.68, p.z); finMesh.setMatrixAt(k, M); k++;
      }
      const gate = i === gateSeg || i === gateSeg + 1;
      const p = polar(FENCE_R, a0), post = box(0.16, gate ? 2.6 : 2.0, 0.16, darkStoneMat);
      post.position.set(p.x, gate ? 1.3 : 1.0, p.z); post.rotation.y = a0; yard.add(post);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), darkStoneMat); ball.position.set(p.x, gate ? 2.7 : 2.1, p.z); yard.add(ball);
    }
    barMesh.count = k; barMesh.castShadow = true; finMesh.count = k; yard.add(barMesh, finMesh);
    for (const y of [0.32, 1.42]) { const rail = new THREE.Mesh(new THREE.TorusGeometry(FENCE_R, 0.022, 6, 160), ironMat); rail.rotation.x = Math.PI / 2; rail.position.y = y; yard.add(rail); }
    // arco do portão com um lampião, no caminho para a catedral
    const gp = polar(FENCE_R, ang(gateSeg)), gp2 = polar(FENCE_R, ang(gateSeg + 1));
    const mid = gp.clone().add(gp2).multiplyScalar(0.5), span = gp.distanceTo(gp2);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(span / 2, 0.035, 8, 32, Math.PI), ironMat); arch.position.set(mid.x, 2.6, mid.z); arch.rotation.y = Math.atan2(gp.x - gp2.x, gp.z - gp2.z) + Math.PI / 2; yard.add(arch);
    const gl = lantern(true); gl.scale.setScalar(0.6); gl.position.set(mid.x, 2.05, mid.z); gl.children[0].visible = false; gl.children[1].visible = false; yard.add(gl);
  }

  /* ---------- cidade e catedral ---------- */
  {
    const city = new THREE.Group(); group.add(city);
    const building = (w: number, h: number, d: number) => {
      const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, off = rnd(), offv = Math.floor(rnd() * 8) / 8;
      for (let i = 0; i < uv.count; i++) { const f = Math.floor(i / 4); uv.setXY(i, uv.getX(i) * (f < 2 ? d : w) / 20 + off, uv.getY(i) * h / 24 + offv); }
      const m = new THREE.Mesh(g, [facade, facade, roofMat, roofMat, facade, facade]); m.position.y = h / 2; return m;
    };
    for (let i = 0; i < 150; i++) {
      const a = rnd() * 6.283, r = rr(15, 48), w = rr(4, 9), d = rr(4, 9), h = rr(7, 18) + Math.max(0, r - 20) * rr(0.2, 0.9);
      if (Math.abs(a - Math.PI) < 0.32 && r > 22 && r < 40) continue; // corredor livre para a catedral
      const g = new THREE.Group(), p = polar(r, a); g.position.set(p.x, 0, p.z); g.rotation.y = rnd() * 6.283;
      g.add(building(w, h, d));
      if (rnd() < 0.7) { const roofH = rr(2, 5), roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, roofH, 4), roofMat); roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); roof.position.y = h + roofH / 2 - 0.05; g.add(roof); }
      for (let c = 0, n = Math.floor(rr(0, 3)); c < n; c++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.6, rr(1, 2.5), 0.6), roofMat), rr(-w / 3, w / 3), h + 1.2, rr(-d / 3, d / 3)));
      if (rnd() < 0.14) { const spH = rr(8, 18), sp = new THREE.Mesh(new THREE.ConeGeometry(rr(0.8, 1.6), spH, 8), roofMat); sp.position.y = h + spH / 2; g.add(sp); }
      city.add(g);
    }
    // a catedral na frente da cadeira 0, depois do portão
    const cath = new THREE.Group(); cath.position.set(0, 0, -34);
    cath.add(building(16, 24, 34));
    const nave = new THREE.Mesh(new THREE.ConeGeometry(11.3, 9, 4), roofMat); nave.rotation.y = Math.PI / 4; nave.scale.set(0.72, 1, 1.5); nave.position.y = 28.4; cath.add(nave);
    for (const x of [-9, 9]) {
      const t = building(6.5, 46, 6.5); t.position.set(x, 23, 15); cath.add(t);
      const sp = new THREE.Mesh(new THREE.ConeGeometry(4.2, 22, 8), roofMat); sp.position.set(x, 57, 15); cath.add(sp);
      for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6, 0.9), roofMat); b.position.set(x + (k % 2 ? 3 : -3), 48, 15 + (k < 2 ? 3 : -3)); cath.add(b); }
    }
    const rose = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshStandardMaterial({ color: 0x3a2214, emissive: 0x9a4a22, emissiveIntensity: 0.6 })); rose.position.set(0, 17, 17.02); cath.add(rose);
    const frame = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.8, 24), darkStoneMat); frame.position.set(0, 17, 17.03); cath.add(frame);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 9), new THREE.MeshBasicMaterial({ color: 0x050405 })); door.position.set(0, 4.5, 17.02); cath.add(door);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0x8a4a22, emissiveIntensity: 0.5 });
    for (const x of [-5.5, -2.5, 2.5, 5.5]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 7), winMat); win.position.set(x, 11, 17.02); cath.add(win); }
    for (let i = 0; i < 6; i++) for (const x of [-8.3, 8.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 14, 1.4), darkStoneMat); b.position.set(x, 7, -14 + i * 5.6); cath.add(b); }
    city.add(cath);
  }

  /* ---------- corvos: sete voando em círculos, dois pousados na grade ---------- */
  {
    const crowMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1, side: THREE.DoubleSide });
    const crow = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), crowMat); body.scale.set(1, 0.8, 2); g.add(body);
      const wings: THREE.Mesh[] = [];
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.16), crowMat); w.geometry.translate(s * 0.225, 0, 0); g.add(w); wings.push(w); }
      return { g, wings };
    };
    for (let i = 0; i < 7; i++) {
      const c = crow();
      crows.push({ ...c, cx: rr(-6, 6), cz: rr(-16, 4), r: rr(4, 9), h: rr(6, 13), speed: rr(0.25, 0.45) * (rnd() < 0.5 ? 1 : -1), phase: rnd() * 6.28, flap: rr(6, 9) });
      group.add(c.g);
    }
    for (const a of [1.1, -2.0]) {
      const c = crow(), p = polar(FENCE_R, a); c.g.position.set(p.x, 2.21, p.z); c.g.rotation.y = rnd() * 6.28;
      c.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * 1.35; w.position.y = 0.02; }); group.add(c.g);
    }
  }

  /* ---------- névoa do chão ---------- */
  {
    const m = new THREE.SpriteMaterial({ map: radialSprite('150,150,175', 0.16), transparent: true, depthWrite: false }); extraMats.push(m);
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(m.clone()); extraMats.push(sp.material); const p = polar(rr(2.5, 9), rnd() * 6.28);
      sp.position.set(p.x, rr(0.25, 0.6), p.z); sp.scale.set(rr(6, 10), rr(2.2, 3.4), 1); group.add(sp);
      puffs.push({ sp, vx: rr(-0.08, 0.08), vz: rr(-0.08, 0.08), ph: rnd() * 6 });
    }
  }

  const deck = deckArt(rng);

  return {
    id: 'graveyard', group, chairs, deck,
    background: new THREE.Color(FOG), fog: new THREE.FogExp2(FOG, 0.03), exposure: 1.05, walkMaxR: FENCE_R - 0.6,
    update(t, dt) {
      for (const c of flickers) {
        c.light.intensity = c.base * (0.78 + 0.14 * Math.sin(t * 11 + c.phase) + 0.08 * Math.sin(t * 27.3 + c.phase * 2));
        for (const k of c.flames) { const g = 0.85 + 0.15 * Math.sin(t * 9 + k.phase) + 0.1 * Math.sin(t * 23 + k.phase * 3); k.flame.scale.set(1 + 0.2 * (g - 0.9), 2 + (g - 0.9), 1); k.halo.material.opacity = 0.55 + (g - 0.9); }
      }
      for (const l of lanternLights) l.light.intensity = l.base * (0.9 + 0.08 * Math.sin(t * 7 + l.phase) + 0.04 * Math.sin(t * 19 + l.phase));
      for (const c of crows) {
        const a = t * c.speed + c.phase;
        c.g.position.set(c.cx + Math.cos(a) * c.r, c.h + Math.sin(t * 0.7 + c.phase) * 0.6, c.cz + Math.sin(a) * c.r);
        c.g.rotation.y = -a + (c.speed > 0 ? 0 : Math.PI);
        c.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * c.flap + c.phase) * 0.7; });
      }
      for (const p of puffs) {
        p.sp.position.x += p.vx * dt; p.sp.position.z += p.vz * dt;
        const r = Math.hypot(p.sp.position.x, p.sp.position.z); if (r > 10 || r < 2) { p.vx *= -1; p.vz *= -1; }
        p.sp.material.opacity = 0.75 + 0.25 * Math.sin(t * 0.4 + p.ph);
      }
    },
    dispose() {
      disposeTree(group);
      for (const m of extraMats) { for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose(); m.dispose(); }
      deck.dispose();
    },
  };
};
