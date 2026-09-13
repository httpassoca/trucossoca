/**
 * Bar de praia: um quiosque na areia no fim de tarde, o sol baixo sobre o mar. A mesa é a de plástico branco com o
 * selo da cerveja meio apagado, as cadeiras são as de plástico, e em volta: o quiosque de sapê com o bar aceso por
 * dentro (balcão, geladeira, lâmpadas de tubo, TV, lousa), a prancha encostada, o carrinho de churrasquinho soltando
 * fumaça, os varais de lâmpadas até os coqueiros, e o vira-lata caramelo deitado na areia ao lado da mesa. A praia
 * em si (areia, mar, coqueiros, gaivotas, guarda-sol, barquinho) está em `bar/beach.ts`; o cachorro em `bar/dog.ts`.
 * Tudo procedural.
 */
import { MANILHA, SUITS, type CardId, type Seat, type Suit } from '@truco/rules';
import * as THREE from 'three';
import { monteSpot, seatAngle, TABLE_R, TABLE_TOP } from '../builders';
import { buildBeach, type Anim } from './bar/beach';
import { buildDog, type Dog } from './bar/dog';
import { at, box, capsule, cyl, disposeTree, glow, placeChair, polar, roundRect, SEAT_BACK_Z, SEAT_H, seeded, shadows, skyDome, speckle, sph, tex } from './kit';
import type { DeckArt, Scenery } from './scenery';

const FONT = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SIGN_FONT = 'Impact, "Arial Narrow", "Helvetica Neue", sans-serif';

export interface BarScenery extends Scenery { dog: Dog }

export const buildBar = (): BarScenery => {
  const rng = seeded(2024);
  const { rnd, rr } = rng;
  const group = new THREE.Group(); group.name = 'bar';
  const anims: Anim[] = [];
  const std = (color: number | string, roughness = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

  /* ---------- texturas ---------- */
  const bambooTex = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#c9a85a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 16) { x.fillStyle = `rgb(${190 + rr(-20, 20)},${160 + rr(-20, 20)},${80 + rr(-15, 15)})`; x.fillRect(i + 1, 0, 14, h); x.fillStyle = 'rgba(60,40,10,.5)'; x.fillRect(i, 0, 2, h); x.fillStyle = 'rgba(255,240,200,.25)'; x.fillRect(i + 4, 0, 3, h); }
    for (let i = 0; i < w; i += 16) for (let j = rr(0, 40); j < h; j += rr(50, 90)) { x.fillStyle = 'rgba(70,50,20,.6)'; x.fillRect(i, j, 16, 3); }
    speckle(x, rng, w, h, 150, ['#5a4a20', '#e8d090'], 1, 4, 0.1, 0.3);
  }, { repeat: [8, 1] });
  const plankTex = tex(512, 256, (x, w, h) => {
    x.fillStyle = '#9a7a4a'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < h; j += 32) { const g = rr(-18, 18); x.fillStyle = `rgb(${150 + g},${118 + g},${72 + g})`; x.fillRect(0, j + 1, w, 30); x.fillStyle = 'rgba(40,25,10,.5)'; x.fillRect(0, j, w, 2); for (let k = 0; k < 6; k++) { x.strokeStyle = 'rgba(60,40,15,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, j + rr(3, 29)); x.lineTo(w, j + rr(3, 29)); x.stroke(); } }
    speckle(x, rng, w, h, 200, ['#5a3a10', '#c8a870'], 1, 6, 0.05, 0.2);
  }, { repeat: [3, 3] });
  const thatchTex = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#a88a48'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { x.strokeStyle = ['#8a6a30', '#c8a860', '#6a5020', '#d8b870'][i % 4]; x.globalAlpha = rr(0.3, 0.8); x.lineWidth = rr(1, 2.5); const px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rr(-4, 4), py + rr(14, 40)); x.stroke(); }
    x.globalAlpha = 1;
  }, { repeat: [14, 3] });
  const azulejoTex = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#b5b0a0'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = rnd() < 0.7 ? '#e8eef0' : '#4fb0c0'; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    speckle(x, rng, w, h, 200, ['#7a8a90', '#c0c8cc'], 2, 8, 0.05, 0.2);
  }, { repeat: [8, 2] });
  const tableTex = tex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#e8e4d6'; x.fillRect(0, 0, w, h);
    speckle(x, rng, w, h, 700, ['#d8d4c4', '#f4f2ea', '#c8c4b4'], 3, 40, 0.06, 0.2);
    // selo da cerveja, meio apagado
    x.save(); x.globalAlpha = 0.5;
    x.fillStyle = '#c8102e'; x.beginPath(); x.arc(512, 512, 150, 0, 7); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 8; x.beginPath(); x.arc(512, 512, 128, 0, 7); x.stroke();
    x.fillStyle = '#fff'; x.font = `italic bold 72px ${SIGN_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BRASMA', 512, 505);
    x.font = `bold 22px ${SIGN_FONT}`; x.fillText('★ ★ ★', 512, 560);
    x.restore();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) { x.globalAlpha = rr(0.3, 0.9); x.beginPath(); x.arc(512 + rr(-160, 160), 512 + rr(-160, 160), rr(3, 14), 0, 7); x.fill(); }
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    // marcas de copo, riscos, areia grudada
    for (let i = 0; i < 12; i++) { x.strokeStyle = `rgba(120,90,40,${rr(0.15, 0.4)})`; x.lineWidth = rr(3, 7); x.beginPath(); x.arc(rr(120, 900), rr(120, 900), rr(28, 40), 0, 7); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(90,90,90,${rr(0.2, 0.5)})`; x.lineWidth = 1.5; const px = rr(0, w), py = rr(0, h); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rr(-60, 60), py + rr(-60, 60)); x.stroke(); }
    speckle(x, rng, w, h, 300, ['#d4b986', '#c6a672'], 1, 2.5, 0.3, 0.7);
    x.strokeStyle = 'rgba(150,150,145,.6)'; x.lineWidth = 30; x.beginPath(); x.arc(512, 512, 495, 0, 7); x.stroke();   // borda gasta
  });
  const signTex = tex(1024, 180, (x, w, h) => {
    x.fillStyle = '#1f8a9a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f3e9d2'; x.font = `bold 118px ${SIGN_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BAR DO TIÃO', 512, 92);
    for (const cx of [90, 934]) { x.fillStyle = '#f2c53d'; x.beginPath(); x.arc(cx, 90, 62, 0, 7); x.fill(); x.fillStyle = '#c8102e'; x.beginPath(); x.arc(cx, 90, 48, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = `italic bold 30px ${SIGN_FONT}`; x.fillText(cx < 512 ? 'BRASMA' : 'SKAL', cx, 90); }
    speckle(x, rng, w, h, 250, ['#000', '#8a4a20'], 2, 10, 0.05, 0.25);
  });
  const chalkTex = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#1e2420'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e8e4d6'; x.font = `bold 30px ${FONT}`; x.textAlign = 'center';
    ['ÁGUA DE COCO', 'R$ 8', 'CERVEJA R$12', 'PEIXE FRITO', 'TRUCO ♠'].forEach((l, i) => x.fillText(l, w / 2, 44 + i * 44));
  });
  const cocoSignTex = tex(256, 320, (x, w, h) => {
    x.fillStyle = '#f6f2e8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2a8a4a'; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16);
    x.fillStyle = '#2a8a4a'; x.font = `bold 52px ${SIGN_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('ÁGUA', w / 2, 70); x.fillText('DE COCO', w / 2, 130); x.fillStyle = '#c8102e'; x.font = `bold 44px ${SIGN_FONT}`; x.fillText('GELADA', w / 2, 200); x.fillText('R$ 8', w / 2, 260);
  });

  /* ---------- materiais ---------- */
  const plastic = std(0xe8e4d6, 0.6);
  const iron = std(0x2a2c30, 0.55, { metalness: 0.7 });
  const chrome = std(0xd0d4d8, 0.3, { metalness: 0.9 });
  const amber = std(0x5a2a0a, 0.15, { transparent: true, opacity: 0.85, metalness: 0.1 });
  const glassMat = std(0xdcebe0, 0.1, { transparent: true, opacity: 0.35 });
  const foam = std(0xfff8e6, 0.9);
  const beer = std(0xe8a020, 0.2, { transparent: true, opacity: 0.8 });
  const wood = std(0x8a6a3a, 0.8);
  const plank = std(plankTex ? 0xffffff : 0x9a7a4a, 0.85, { map: plankTex });
  const bamboo = std(bambooTex ? 0xffffff : 0xc9a85a, 0.85, { map: bambooTex });
  const thatch = std(thatchTex ? 0xffffff : 0xa88a48, 1, { map: thatchTex, side: THREE.DoubleSide });
  const coco = std(0x5f8a2e, 0.7);

  /* ---------- céu, sol baixo sobre o mar, luz ---------- */
  group.add(skyDome([[0, '#3a4a8a'], [0.4, '#7a6a9a'], [0.65, '#d88a5a'], [0.82, '#f6b070'], [1, '#ffd8a0']]));
  const sunDir = new THREE.Vector3(Math.cos(0.16) * Math.cos(0.3), Math.sin(0.16), Math.cos(0.16) * Math.sin(0.3)).normalize();   // a uns 9° sobre o mar, em +x
  const sunDisc = glow('255,200,120', 0.95, 70, false); sunDisc.position.copy(sunDir).multiplyScalar(220); group.add(sunDisc);
  const sunHalo = glow('255,170,90', 0.35, 160, false); sunHalo.position.copy(sunDir).multiplyScalar(215); group.add(sunHalo);
  const sun = new THREE.DirectionalLight(0xffb878, 1.7); sun.position.copy(sunDir).multiplyScalar(40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -10; sc.right = sc.top = 10; sc.near = 5; sc.far = 90;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0x8aa0c8, 0xc8a060, 0.55));

  /* ---------- a praia ---------- */
  const beach = buildBeach(rng, group, anims);

  /* ---------- o quiosque: paredes de bambu, frente aberta, sapê, e o bar aceso por dentro ---------- */
  const bar = new THREE.Group(); bar.position.z = -8.8; group.add(bar);   // frente aberta em z = -6.55
  const W = 8, H = 2.6, D = 4.5, RW = W + 1.8, RD = D + 1.8;
  bar.add(at(box(W, 0.06, D, plank), 0, 0.03, 0));   // deck de tábuas sobre a areia
  bar.add(at(box(W, H, 0.12, bamboo), 0, H / 2, -D / 2), at(box(0.12, H, D, bamboo), -W / 2, H / 2, 0), at(box(0.12, H, D, bamboo), W / 2, H / 2, 0));
  bar.add(at(box(W - 0.4, 1.3, 0.02, std(azulejoTex ? 0xffffff : 0xd8dcd8, 0.5, { map: azulejoTex })), 0, 0.9, -D / 2 + 0.08));   // azulejo atrás do balcão
  for (const x of [-W / 2, -1.4, 1.4, W / 2]) bar.add(at(cyl(0.09, 0.11, H + 0.1, wood, 10), x, (H + 0.1) / 2, D / 2));
  bar.add(at(box(W + 0.3, 0.14, 0.14, wood), 0, H + 0.05, D / 2), at(box(W + 0.3, 0.14, 0.14, wood), 0, H + 0.05, -D / 2));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1.7, 4, 1, true), thatch); roof.rotation.y = Math.PI / 4; roof.scale.set(RW / Math.SQRT2, 1, RD / Math.SQRT2); roof.position.y = H + 0.85; roof.castShadow = roof.receiveShadow = true; bar.add(roof);
  for (const sz of [-1, 1]) bar.add(at(box(RW, 0.4, 0.05, thatch), 0, H - 0.12, sz * RD / 2), at(box(0.05, 0.4, RD, thatch), sz * RW / 2, H - 0.12, 0));   // franja do sapê
  bar.add(at(sph(0.22, thatch, 10), 0, H + 1.7, 0));
  const sign = at(box(3.6, 0.7, 0.08, std(signTex ? 0xffffff : 0x1f8a9a, 0.8, { map: signTex })), 0, H + 0.55, RD / 2 - 0.3); sign.rotation.x = -0.18; bar.add(sign);
  bar.add(at(box(0.55, 0.6, 0.03, std(chalkTex ? 0xffffff : 0x1e2420, 0.9, { map: chalkTex })), -1.4, 1.55, D / 2 + 0.1));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); bulb.position.set(0, H - 0.2, D / 2 + 0.15); bar.add(bulb);
  bar.add(at(new THREE.PointLight(0xffd08a, 1.4, 7, 2), 0, H - 0.25, D / 2 + 0.2));
  // balcão, geladeira, freezer, tubos, TV
  bar.add(at(box(4.5, 1.05, 0.6, plank), 0, 0.555, 0.2), at(box(4.6, 0.05, 0.7, std(0xe0dcd0, 0.35, { metalness: 0.2 })), 0, 1.1, 0.2));
  for (let i = 0; i < 7; i++) bar.add(at(cyl(0.03, 0.03, rr(0.22, 0.3), i % 3 ? amber : glassMat, 8), -2 + i * 0.5, 1.25, 0.15));   // garrafas no balcão
  for (let i = 0; i < 3; i++) { const c = at(sph(0.11, coco, 12), 1.6 + i * 0.24, 1.23, 0.2); c.scale.y = 1.15; bar.add(c); }   // cocos no balcão, um com canudo
  bar.add(at(cyl(0.006, 0.006, 0.2, std(0xf05a28, 0.5), 5), 2.1, 1.42, 0.2).rotateZ(0.25));
  const fridge = new THREE.Group(); fridge.position.set(3.0, 0.06, -D / 2 + 0.5); bar.add(fridge);
  fridge.add(at(box(0.7, 1.9, 0.7, std(0xf0f0ea, 0.5)), 0, 0.95, 0));
  const fridgeGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.6), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xcfe8ff, emissiveIntensity: 1.2, roughness: 0.2 })); fridgeGlass.position.set(0, 1.0, 0.36); fridge.add(fridgeGlass);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) fridge.add(at(cyl(0.035, 0.035, 0.22, amber, 8), -0.16 + i * 0.16, 0.35 + j * 0.4, 0.2));
  fridge.add(at(new THREE.PointLight(0xcfe8ff, 1.8, 6, 2), 0, 1.0, 0.6));
  bar.add(at(box(1.5, 0.85, 0.65, std(0xf5f5f0, 0.5)), -2.8, 0.485, -D / 2 + 0.45));   // freezer horizontal
  const tubeMats: THREE.MeshStandardMaterial[] = [];
  for (const z of [0.9, -0.9]) { const m = new THREE.MeshStandardMaterial({ color: 0xdff5e8, emissive: 0xdff5e8, emissiveIntensity: 2 }); tubeMats.push(m); bar.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.08), m), 0, H - 0.1, z)); }
  const tubeLight = at(new THREE.PointLight(0xdff5e8, 2.0, 9, 2), 0, H - 0.2, 0); bar.add(tubeLight);
  const tv = new THREE.Group(); tv.position.set(W / 2 - 0.4, 2.0, 0.8); tv.rotation.y = -Math.PI / 2 + 0.35; bar.add(tv);
  tv.add(at(box(0.5, 0.42, 0.45, std(0x2a2a2e, 0.6)), 0, 0, 0), at(box(0.12, 0.08, 0.6, iron), 0, -0.26, -0.1));
  const screen = new THREE.MeshStandardMaterial({ color: 0x8ab4ff, emissive: 0x8ab4ff, emissiveIntensity: 1.2, roughness: 0.3 });
  tv.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), screen), 0, 0, 0.226));
  shadows(bar, (o) => o === bulb || o === fridgeGlass);
  // fora: a prancha encostada, a placa da água de coco com a pilha de cocos, engradados, botijão
  const board = new THREE.Group(); board.position.set(W / 2 + 0.28, 0, -1.2); board.rotation.z = 0.2; bar.add(board);
  const deckMat = std(0xf4efe0, 0.5);
  const hull = at(capsule(0.26, 1.5, deckMat, 16), 0, 1.0, 0); hull.scale.z = 0.16; board.add(hull);
  board.add(at(box(0.08, 1.9, 0.02, std(0x1f6fd1, 0.5)), 0.0, 1.0, 0.045), at(box(0.03, 0.14, 0.12, deckMat), 0, 0.2, -0.08));
  const cocoSign = new THREE.Group(); cocoSign.position.set(-3.3, 0, D / 2 + 0.7); cocoSign.rotation.y = 0.35; bar.add(cocoSign);
  const signBoard = at(box(0.7, 0.9, 0.04, std(cocoSignTex ? 0xffffff : 0xf6f2e8, 0.8, { map: cocoSignTex })), 0, 0.5, 0.1); signBoard.rotation.x = -0.2; cocoSign.add(signBoard);
  cocoSign.add(at(box(0.04, 0.9, 0.04, wood), -0.3, 0.45, -0.15).rotateX(0.3), at(box(0.04, 0.9, 0.04, wood), 0.3, 0.45, -0.15).rotateX(0.3));
  const crate = (color: number) => { const g = new THREE.Group(); g.add(box(0.51, 0.315, 0.355, std(color, 0.7))); for (let i = 0; i < 6; i++) g.add(at(cyl(0.028, 0.028, 0.1, amber, 8), -0.18 + (i % 3) * 0.18, 0.18, -0.08 + Math.floor(i / 3) * 0.16)); return g; };
  bar.add(at(crate(0xf2c200), 2.6, 0.16, D / 2 + 0.55), at(crate(0xc0392b), 2.6, 0.49, D / 2 + 0.55), at(crate(0x1f4e9a), 3.2, 0.16, D / 2 + 0.6));
  const pile = new THREE.Group(); pile.position.set(-2.4, 0, D / 2 + 0.6); bar.add(pile);
  pile.add(box(0.6, 0.3, 0.45, std(0x8a6a3a, 0.8)));
  const cocoAt: [number, number, number][] = [[-0.15, 0.26, -0.1], [0.15, 0.26, -0.1], [0, 0.26, 0.12], [-0.15, 0.26, 0.12], [0.15, 0.26, 0.12], [0, 0.44, 0]];
  for (const [x, y, z] of cocoAt) { const c = at(sph(0.11, coco, 12), x, y, z); c.scale.y = 1.15; pile.add(c); }
  bar.add(at(cyl(0.18, 0.18, 0.58, std(0x1f5fa8, 0.5, { metalness: 0.3 }), 16), 3.75, 0.29, D / 2 + 0.55));
  shadows(board); shadows(cocoSign); shadows(pile);

  /* ---------- o carrinho de churrasquinho ---------- */
  const cart = new THREE.Group(); cart.position.set(-2.4, 0, 4.1); cart.rotation.y = 0.2; group.add(cart);
  cart.add(at(box(1.2, 0.75, 0.6, std(0xc0392b, 0.7)), 0, 0.5, 0), at(box(1.2, 0.1, 0.6, std(0xf1e3c8, 0.7)), 0, 0.92, 0), at(box(1.1, 0.03, 0.5, iron), 0, 0.98, 0));
  for (const sx of [-1, 1]) { const w = cyl(0.22, 0.22, 0.06, iron, 14); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.66, 0.22, 0); cart.add(w); }
  const coalMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xff5a1f, emissiveIntensity: 1.5, roughness: 1 });
  for (let i = 0; i < 12; i++) cart.add(at(new THREE.Mesh(new THREE.SphereGeometry(rr(0.03, 0.05), 6, 5), coalMat), rr(-0.45, 0.45), 1.0, rr(-0.18, 0.18)));
  for (let i = 0; i < 5; i++) cart.add(at(box(0.02, 0.02, 0.3, std(0x5a3a20, 0.8)), -0.4 + i * 0.2, 1.05, 0).rotateY(rr(-0.2, 0.2)));
  cart.add(at(new THREE.PointLight(0xff5a1f, 0.9, 3, 2), 0, 1.1, 0), at(cyl(0.02, 0.02, 2.2, iron, 6), 0.5, 1.1, -0.25));
  shadows(cart, (o) => o.material === coalMat);
  const smokeMat = new THREE.SpriteMaterial({ map: (() => { const m = glow('150,150,160', 0.22, 1).material as THREE.SpriteMaterial; return m.map; })(), transparent: true, depthWrite: false, opacity: 0.5 });
  const puffs: { sp: THREE.Sprite; ph: number }[] = [];
  for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(smokeMat.clone()); sp.position.set(0, 1.1, 0); cart.add(sp); puffs.push({ sp, ph: i / 7 }); }
  anims.push((t) => puffs.forEach(({ sp, ph }) => { const u = (t * 0.22 + ph) % 1; sp.position.set(Math.sin(u * 6 + ph * 9) * 0.25 * u, 1.1 + u * 2.6, 0.1 * u); sp.scale.setScalar(0.3 + u * 1.4); (sp.material as THREE.SpriteMaterial).opacity = 0.45 * (1 - u) * Math.min(1, u * 6); }));

  /* ---------- varais de lâmpadas: do quiosque ao coqueiro, e de coqueiro a coqueiro por cima da mesa ---------- */
  const wireMat = new THREE.LineBasicMaterial({ color: 0x0a0a0c });
  const bulbString = (a: THREE.Vector3, b: THREE.Vector3, n: number, phase: number) => {
    const bulbs: THREE.Sprite[] = [];
    for (let i = 0; i < n; i++) { const s = glow('255,200,120', 0.9, 0.25); bulbs.push(s); group.add(s); }
    const segs = 2 * n, pts = new THREE.Float32BufferAttribute((segs + 1) * 3, 3).setUsage(THREE.DynamicDrawUsage);   // uma lâmpada a cada dois pontos
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', pts), wireMat); line.frustumCulled = false; group.add(line);
    const _p = new THREE.Vector3();
    anims.push((t) => {
      const sway = Math.sin(t * 0.8 + phase) * 0.06;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, sag = Math.sin(u * Math.PI);
        _p.lerpVectors(a, b, u); _p.x += sway * sag; _p.y -= sag * 0.5;
        pts.setXYZ(i, _p.x, _p.y, _p.z);
        if (i % 2 === 0 && i >= 2) bulbs[i / 2 - 1].position.set(_p.x, _p.y - 0.08, _p.z);
      }
      pts.needsUpdate = true;
    });
  };
  bulbString(new THREE.Vector3(-RW / 2 + 0.3, H + 0.1, -8.8 + RD / 2), beach.palmAt(0, 0.72), 6, 0);
  bulbString(beach.palmAt(0, 0.72), beach.palmAt(1, 0.68), 8, 1.7);
  group.add(at(new THREE.PointLight(0xffd0a0, 1.0, 9, 2), 0, 3.6, -1.0));

  /* ---------- a mesa ---------- */
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - 0.03, 0.04, 64), std(tableTex ? 0xffffff : 0xe8e4d6, 0.55, { map: tableTex })); top.name = 'tableTop';
  top.position.y = TABLE_TOP - 0.02; top.castShadow = top.receiveShadow = true; group.add(top);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R - 0.005, 0.022, 10, 64), plastic); lip.rotation.x = Math.PI / 2; lip.position.y = TABLE_TOP - 0.03; lip.name = 'tableLip'; group.add(lip);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(at(cyl(0.025, 0.028, TABLE_TOP - 0.04, plastic, 10), sx * 0.62, (TABLE_TOP - 0.04) / 2, sz * 0.62));
  group.add(at(box(0.3, 0.04, 0.3, wood), 0.62, (TABLE_TOP - 0.04) / 2 - 0.35, 0));   // travessa entre as pernas
  group.add(at(box(0.08, 0.02, 0.08, std(0xb08a50, 0.9)), -0.62, 0.01, 0.62));   // calço de papelão

  /* ---------- as cadeiras ---------- */
  const chairs: THREE.Group[] = [];
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const g = new THREE.Group();
    // o assento fica sob a metade de trás do corpo e o encosto atrás dele (z ≥ SEAT_BACK_Z), fora do feijão sentado
    const s = box(0.42, 0.04, 0.46, plastic); s.name = 'seat'; s.position.set(0, SEAT_H - 0.02, 0.23); g.add(s);
    for (const sx of [-1, 1]) for (const z of [0.03, 0.43]) g.add(at(cyl(0.02, 0.022, SEAT_H - 0.04, plastic, 8), sx * 0.17, (SEAT_H - 0.04) / 2, z));
    for (const sx of [-1, 1]) g.add(at(box(0.04, 0.55, 0.04, plastic), sx * 0.19, SEAT_H + 0.275, SEAT_BACK_Z));
    g.add(at(box(0.42, 0.05, 0.04, plastic), 0, SEAT_H + 0.53, SEAT_BACK_Z));
    for (let i = 0; i < 5; i++) g.add(at(box(0.04, 0.42, 0.03, plastic), -0.14 + i * 0.07, SEAT_H + 0.28, SEAT_BACK_Z + 0.005));
    shadows(g);
    chairs.push(placeChair(g, seat)); group.add(g);
  }

  /* ---------- em cima da mesa: só na borda, fora das cartas e dos quatro lugares do monte ---------- */
  // o monte fica em frente à mão, à direita dela (`monteSpot`): a 0.82 do centro, no ângulo da cadeira + 0.54; nada a menos de 0.25 dele
  const MONTES = ([0, 1, 2, 3] as Seat[]).map(monteSpot);
  const clearOfMontes = (a: number, r: number) => { const p = polar(r, a); return MONTES.every((m) => Math.hypot(p.x - m.x, p.z - m.z) > 0.3); };
  const onTable = (a: number, r: number, obj: THREE.Object3D, yaw = 0) => { const p = polar(r, a); obj.position.set(p.x, TABLE_TOP, p.z); obj.rotation.y = yaw; group.add(obj); return obj; };
  const bottle = (full: boolean) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.036, 0.036, 0.16, amber, 14), 0, 0.08, 0), at(cyl(0.014, 0.034, 0.06, amber, 12), 0, 0.19, 0), at(cyl(0.014, 0.014, 0.04, amber, 10), 0, 0.235, 0));
    g.add(at(cyl(0.037, 0.037, 0.05, std(full ? 0xf2c53d : 0xf4f0e8, 0.6), 14), 0, 0.09, 0));   // rótulo
    if (full) g.add(at(cyl(0.016, 0.016, 0.01, std(0xc8a040, 0.4, { metalness: 0.6 }), 10), 0, 0.26, 0));
    shadows(g); return g;
  };
  const glass = (fill: number) => {
    const g = new THREE.Group();
    g.add(at(cyl(0.033, 0.023, 0.092, glassMat, 10), 0, 0.046, 0));
    if (fill > 0) g.add(at(cyl(0.03, 0.024, 0.09 * fill, beer, 10), 0, 0.045 * fill + 0.004, 0), at(cyl(0.031, 0.03, 0.015, foam, 10), 0, 0.09 * fill + 0.012, 0));
    shadows(g); return g;
  };
  // um copo à esquerda de cada cadeira (o monte fica à direita)
  for (const seat of [0, 1, 2, 3] as Seat[]) onTable(seatAngle(seat) - 0.45, 0.98, glass([0.5, 0.2, 0.7, 0][seat]));
  // entre as cadeiras 0 e 1: as cervejas, os molhos, a porção de fritas e o amendoim
  onTable(0.85, 1.0, bottle(true)); onTable(0.97, 1.07, bottle(true));
  for (let i = 0; i < 3; i++) onTable(1.26 + i * 0.06, 1.04, box(0.04, 0.006, 0.07, std([0xc0272d, 0xf4d35e, 0xc0272d][i], 0.7)), rr(-0.4, 0.4)).position.y += 0.003;
  const plate = new THREE.Group();
  plate.add(at(cyl(0.12, 0.1, 0.015, std(0xf4f0e8, 0.5), 20), 0, 0.008, 0), at(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 6, 24), std(0x2f6b3a, 0.6)).rotateX(Math.PI / 2), 0, 0.016, 0));
  for (let i = 0; i < 16; i++) plate.add(at(box(0.012, 0.012, rr(0.04, 0.08), std(0xe8b84a, 0.7)), rr(-0.06, 0.06), 0.025, rr(-0.06, 0.06)).rotateY(rnd() * 3).rotateX(rr(-0.3, 0.3)));
  onTable(1.56, 1.0, plate);
  onTable(1.82, 1.05, box(0.1, 0.12, 0.03, std(0xf4f0e8, 0.6)), 0.3).position.y += 0.06;   // saco de amendoim
  // entre as cadeiras 1 e 2: a água de coco, no coco, com canudo
  const cocoCup = new THREE.Group(); const cc = at(sph(0.065, coco, 14), 0, 0.06, 0); cc.scale.y = 1.15; cocoCup.add(cc, at(cyl(0.005, 0.005, 0.16, std(0xf05a28, 0.5), 5), 0.01, 0.17, 0).rotateZ(0.2));
  shadows(cocoCup); onTable(3.05, 1.0, cocoCup);
  // entre as cadeiras 2 e 3: guardanapeiro, paliteiro, a garrafa vazia deitada na borda
  onTable(4.1, 1.02, box(0.1, 0.09, 0.05, std(0xf8f8f8, 0.9)), 0.3).position.y += 0.045;   // guardanapeiro
  onTable(4.42, 1.0, cyl(0.02, 0.02, 0.05, chrome, 10), 0).position.y += 0.025;   // paliteiro
  const empty = bottle(false); onTable(4.65, 1.0, empty, 4.65); empty.rotation.z = Math.PI / 2 - 0.05; empty.position.y = TABLE_TOP + 0.036;   // vazia, deitada na borda
  // entre as cadeiras 3 e 0: cinzeiro, maço, isqueiro, fósforos (quem senta na 0 fuma)
  const ash = new THREE.Group(); ash.add(at(cyl(0.05, 0.04, 0.02, glassMat, 12), 0, 0.01, 0));
  for (let i = 0; i < 5; i++) ash.add(at(cyl(0.004, 0.004, 0.03, std(0xe8dcc0, 0.9), 6), rr(-0.02, 0.02), 0.022, rr(-0.02, 0.02)).rotateX(rr(-1.2, 1.2)));
  ash.add(at(cyl(0.025, 0.02, 0.008, std(0xb0a090, 1), 8), 0, 0.02, 0));
  onTable(6.1, 0.98, ash);
  onTable(6.28, 1.04, box(0.055, 0.022, 0.088, std(0xe30613, 0.6)), 0.4).position.y += 0.011;
  onTable(6.4, 0.97, cyl(0.012, 0.012, 0.08, std(0x0057b8, 0.5), 8), 0).rotation.set(Math.PI / 2, 0, 0.8);
  onTable(6.22, 0.96, box(0.053, 0.015, 0.036, std(0xf6c51b, 0.8)), 1.1).position.y += 0.008;
  for (let n = 0; n < 7;) { const a = rr(0, 6.28), r = rr(0.95, 1.1); if (!clearOfMontes(a, r)) continue; onTable(a, r, cyl(0.014, 0.014, 0.004, chrome, 8), 0).position.y += 0.002; n++; }   // tampinhas: placar
  // no chão: balde de gelo e isopor
  const bucket = new THREE.Group(); bucket.position.set(1.1, 0, 1.5); group.add(bucket);
  bucket.add(at(cyl(0.13, 0.1, 0.24, std(0xc0392b, 0.6), 14), 0, 0.12, 0));
  for (const [x, z, r] of [[-0.04, 0.02, 0.15], [0.05, -0.03, -0.2]]) { const b = bottle(true); b.position.set(x, 0.12, z); b.rotation.z = r; bucket.add(b); }
  const isopor = new THREE.Group(); isopor.position.set(1.6, 0, -0.9); isopor.rotation.y = 0.5; group.add(isopor);
  isopor.add(at(box(0.47, 0.33, 0.33, std(0xf5f5f0, 0.9)), 0, 0.165, 0), at(box(0.49, 0.03, 0.35, std(0xf5f5f0, 0.9)), 0, 0.345, 0), at(box(0.5, 0.02, 0.04, std(0x1f5fa8, 0.7)), 0, 0.35, 0));
  shadows(bucket); shadows(isopor);

  /* ---------- o vira-lata caramelo, na areia ao lado da mesa ---------- */
  const dog = buildDog(rng); group.add(dog.group);
  anims.push((t, dt) => dog.update(t, dt));

  /* ---------- luzes que vivem ---------- */
  anims.push((t) => {
    screen.emissiveIntensity = 0.9 + 0.35 * Math.sin(t * 9.3) * Math.sin(t * 2.1) + 0.2 * (rnd() - 0.5);
    const blink = Math.sin(t * 5.1) * Math.sin(t * 13.7) > 0.72 ? 0.2 : 2;   // um tubo pisca de vez em quando
    tubeMats[1].emissiveIntensity = blink; tubeLight.intensity = 1.4 + 0.3 * blink;
  });

  /* ---------- baralho: Copag ---------- */
  const faces = new Map<CardId, THREE.Texture | null>();
  const deck: DeckArt = {
    roughness: 0.7, metalness: 0,
    dispose() { deck.back?.dispose(); for (const f of faces.values()) f?.dispose(); faces.clear(); },
    back: tex(256, 364, (x) => {
      x.fillStyle = '#f8f4ea'; roundRect(x, 0, 0, 256, 364, 20); x.fill();
      x.fillStyle = '#b02030'; roundRect(x, 12, 12, 232, 340, 12); x.fill();
      x.save(); x.beginPath(); roundRect(x, 18, 18, 220, 328, 8); x.clip();
      x.strokeStyle = 'rgba(255,230,220,.55)'; x.lineWidth = 1.5;
      for (let i = -364; i < 364; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 364, 364); x.stroke(); x.beginPath(); x.moveTo(i + 364, 0); x.lineTo(i, 364); x.stroke(); }
      x.strokeStyle = 'rgba(120,10,25,.6)'; for (let i = 0; i < 364; i += 24) { x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
      x.restore();
      x.strokeStyle = '#f8f4ea'; x.lineWidth = 2; roundRect(x, 24, 24, 208, 316, 8); x.stroke();
      x.fillStyle = '#f8f4ea'; x.beginPath(); x.ellipse(128, 182, 40, 58, 0, 0, 7); x.fill();
      x.fillStyle = '#b02030'; x.font = `bold 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('139', 128, 182);
    }),
    face(id) {
      if (!faces.has(id)) faces.set(id, tex(256, 364, (x) => {
        const suit = id[1] as Suit, red = suit === 'h' || suit === 'd', col = red ? '#c8402e' : '#1a1a1a', r = id[0], s = SUITS[suit];
        x.fillStyle = '#faf6ec'; roundRect(x, 0, 0, 256, 364, 20); x.fill();
        x.strokeStyle = 'rgba(40,30,20,.5)'; x.lineWidth = 3; roundRect(x, 6, 6, 244, 352, 16); x.stroke();
        if (MANILHA[id]) { x.strokeStyle = '#e8b53a'; x.lineWidth = 10; roundRect(x, 12, 12, 232, 340, 14); x.stroke(); }
        x.fillStyle = col; x.textBaseline = 'top'; x.textAlign = 'left';
        const corner = () => { x.font = `bold 56px ${FONT}`; x.fillText(r, 18, 14); x.font = '48px sans-serif'; x.fillText(s, 20, 68); };
        corner(); x.save(); x.translate(256, 364); x.rotate(Math.PI); corner(); x.restore();
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '150px sans-serif'; x.fillText(s, 128, 190);
        if (MANILHA[id]) { x.fillStyle = '#b8862b'; x.font = `bold 22px ${FONT}`; x.fillText('MANILHA', 128, 300); }
      }));
      return faces.get(id) ?? null;
    },
  };

  return {
    id: 'bar', group, chairs, dog,
    background: new THREE.Color(0xf0b888), fog: new THREE.FogExp2(0xf0b888, 0.011), exposure: 1.0, walkMaxR: 6.4, deck,
    update(t, dt) { for (const a of anims) a(t, dt); },
    react(kind) { dog.react(kind); },
    /** a areia: plana em volta da mesa, descendo para o mar a partir de x = 6 */
    floorAt: (x, z) => beach.sandH(x, z),
    dispose() { disposeTree(group); deck.dispose(); },
  };
};
