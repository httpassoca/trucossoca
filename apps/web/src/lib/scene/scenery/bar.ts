/**
 * Bar de esquina: um boteco na calçada, no fim de tarde quase noite. A mesa é a de plástico branco com o selo da
 * cerveja meio apagado, as cadeiras são as de plástico, e em volta: a fachada do bar aceso (balcão, geladeira,
 * lâmpadas de tubo, TV), o muro pichado, o poste de sódio com mariposas, o Fusca, a árvore caiada, o carrinho de
 * churrasquinho soltando fumaça, o orelhão, engradados e o vira-lata caramelo debaixo da mesa. Tudo procedural.
 */
import { MANILHA, SUITS, type CardId, type Seat, type Suit } from '@truco/rules';
import * as THREE from 'three';
import { seatAngle, TABLE_R, TABLE_TOP } from '../builders';
import { at, box, cyl, disposeTree, glow, placeChair, polar, roundRect, SEAT_BACK_Z, SEAT_H, seeded, shadows, skyDome, speckle, tex } from './kit';
import type { DeckArt, Scenery, SceneryBuilder } from './scenery';

const FONT = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SIGN_FONT = 'Impact, "Arial Narrow", "Helvetica Neue", sans-serif';
const STREET_Y = -0.08;   // o asfalto fica abaixo da calçada; o meio-fio é a diferença

type Anim = (t: number, dt: number) => void;

export const buildBar: SceneryBuilder = () => {
  const rng = seeded(2024);
  const { rnd, rr } = rng;
  const group = new THREE.Group(); group.name = 'bar';
  const anims: Anim[] = [];
  const std = (color: number | string, roughness = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });

  /* ---------- texturas ---------- */
  const slabTex = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#8a8a82'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const g = 130 + rr(-14, 14); x.fillStyle = `rgb(${g},${g},${g - 6})`; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(i * 128, j * 128, 128, 2); x.fillRect(i * 128, j * 128, 2, 128);
    }
    speckle(x, rng, w, h, 900, ['#5a5a54', '#a0a098', '#3a3a36', '#6a6a60'], 2, 12, 0.08, 0.3);
    x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) { x.beginPath(); let px = rnd() * w, py = rnd() * h; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += rr(-30, 30); py += rr(-30, 30); x.lineTo(px, py); } x.stroke(); }
  }, { repeat: 6 });
  const asphaltTex = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#1e2226'; x.fillRect(0, 0, w, h);
    speckle(x, rng, w, h, 3000, ['#2a2e33', '#14171a', '#33373c', '#0e1012'], 1, 4, 0.2, 0.6);
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(60,50,40,.18)'; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, rr(30, 90), rr(15, 40), rnd() * 3, 0, 7); x.fill(); }
  }, { repeat: 30 });
  const paintTex = (base: string, barra: string) => tex(512, 512, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    x.fillStyle = barra; x.fillRect(0, h * 0.7, w, h * 0.3);
    speckle(x, rng, w, h, 500, ['#000', '#fff', '#8a4a20'], 3, 18, 0.03, 0.14);
    for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(160,80,30,.35)'; x.fillRect(rnd() * w, rnd() * h * 0.7, rr(2, 5), rr(20, 90)); }   // ferrugem escorrendo
    for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(90,80,70,.5)'; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, rr(8, 30), rr(6, 20), rnd() * 3, 0, 7); x.fill(); }   // descascado
  });
  const azulejoTex = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#b5b0a0'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = rnd() < 0.8 ? '#e8eef0' : '#9cc4d8'; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    speckle(x, rng, w, h, 200, ['#7a8a90', '#c0c8cc'], 2, 8, 0.05, 0.2);
  }, { repeat: [8, 2] });
  const wallTex = tex(1024, 512, (x, w, h) => {
    x.fillStyle = '#d9c9a1'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 8; j++) { let l = j % 2 ? -20 : 0; while (l < w) { x.strokeStyle = 'rgba(0,0,0,.12)'; x.strokeRect(l, j * 64, 80, 64); l += 80; } }
    speckle(x, rng, w, h, 1200, ['#a89870', '#f0e4c0', '#6a5a40'], 2, 14, 0.05, 0.2);
    // pichação: letras espetadas em preto
    x.strokeStyle = 'rgba(10,10,10,.85)'; x.lineWidth = 6; x.lineCap = 'round';
    for (let i = 0; i < 26; i++) { const px = rr(20, w - 60), py = rr(120, h - 40); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rr(-20, 20), py - rr(50, 110)); x.lineTo(px + rr(20, 45), py + rr(-10, 10)); x.stroke(); }
    // cartazes rasgados
    for (let i = 0; i < 5; i++) { const px = rr(0, w - 160), py = rr(20, 200); x.fillStyle = ['#e63946', '#f4d35e', '#2a9d8f', '#f1e3c8'][i % 4]; x.fillRect(px, py, rr(90, 160), rr(110, 170)); x.fillStyle = 'rgba(0,0,0,.7)'; x.font = `bold 36px ${SIGN_FONT}`; x.fillText(['BAILE', 'FORRÓ', 'VOTE', 'SHOW'][i % 4], px + 12, py + 50); }
  }, { repeat: [2, 1] });
  const facadeTex = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#3a3438'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) { const lit = rnd() < 0.12; x.fillStyle = lit ? '#ffcf7a' : '#100e14'; x.fillRect(i * 84 + 24, j * 64 + 14, 36, 44); }
    speckle(x, rng, w, h, 400, ['#221e24', '#4a444c'], 3, 20, 0.05, 0.25);
  }, { repeat: 1 });
  const corrugatedTex = tex(256, 128, (x, w, h) => {
    x.fillStyle = '#777c80'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 16) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(i, 0, 4, h); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(i + 8, 0, 3, h); }
    speckle(x, rng, w, h, 200, ['#8a4a20', '#3a3a3c'], 2, 10, 0.1, 0.4);
    x.fillStyle = 'rgba(120,60,20,.5)'; x.fillRect(0, h - 22, w, 22);   // ferrugem embaixo
  }, { repeat: [6, 1] });
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
    // marcas de copo e riscos
    for (let i = 0; i < 12; i++) { x.strokeStyle = `rgba(120,90,40,${rr(0.15, 0.4)})`; x.lineWidth = rr(3, 7); x.beginPath(); x.arc(rr(120, 900), rr(120, 900), rr(28, 40), 0, 7); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(90,90,90,${rr(0.2, 0.5)})`; x.lineWidth = 1.5; const px = rr(0, w), py = rr(0, h); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rr(-60, 60), py + rr(-60, 60)); x.stroke(); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(58,42,32,.8)'; x.beginPath(); x.arc(rr(80, 940), rr(80, 940), rr(4, 7), 0, 7); x.fill(); }   // queimaduras de cigarro
    x.strokeStyle = 'rgba(150,150,145,.6)'; x.lineWidth = 30; x.beginPath(); x.arc(512, 512, 495, 0, 7); x.stroke();   // borda gasta
  });
  const signTex = tex(1024, 180, (x, w, h) => {
    x.fillStyle = '#b2352b'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f3e9d2'; x.font = `bold 118px ${SIGN_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BAR DO TIÃO', 512, 92);
    for (const cx of [90, 934]) { x.fillStyle = '#f2c53d'; x.beginPath(); x.arc(cx, 90, 62, 0, 7); x.fill(); x.fillStyle = '#c8102e'; x.beginPath(); x.arc(cx, 90, 48, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = `italic bold 30px ${SIGN_FONT}`; x.fillText(cx < 512 ? 'BRASMA' : 'SKAL', cx, 90); }
    speckle(x, rng, w, h, 250, ['#000', '#8a4a20'], 2, 10, 0.05, 0.25);
  });
  const chalkTex = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#1e2420'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e8e4d6'; x.font = `bold 34px ${FONT}`; x.textAlign = 'center';
    ['CERVEJA', '600 R$12', 'PORÇÃO', 'R$ 25', 'TRUCO ♠'].forEach((l, i) => x.fillText(l, w / 2, 48 + i * 42));
  });

  /* ---------- materiais ---------- */
  const concrete = std(0x8a8a82, 1, { map: slabTex });
  const asphalt = std(0x1e2226, 0.45, { map: asphaltTex, metalness: 0.15 });
  const plastic = std(0xe8e4d6, 0.6);
  const iron = std(0x2a2c30, 0.55, { metalness: 0.7 });
  const chrome = std(0xd0d4d8, 0.3, { metalness: 0.9 });
  const amber = std(0x5a2a0a, 0.15, { transparent: true, opacity: 0.85, metalness: 0.1 });
  const glassMat = std(0xdcebe0, 0.1, { transparent: true, opacity: 0.35 });
  const foam = std(0xfff8e6, 0.9);
  const beer = std(0xe8a020, 0.2, { transparent: true, opacity: 0.8 });
  const wood = std(0x6b4a2b, 0.8);
  const roofMat = std(0x2a2226, 0.95);

  /* ---------- céu, sol, chão ---------- */
  group.add(skyDome([[0, '#221c3a'], [0.5, '#5a3050'], [0.78, '#b0563a'], [1, '#ff9a4a']]));
  const sunDir = new THREE.Vector3(-Math.cos(0.21) * Math.cos(0.35), Math.sin(0.21), Math.cos(0.21) * Math.sin(0.35)).normalize();   // atrás da cadeira 3, sobre a rua
  const sunDisc = glow('255,190,110', 0.9, 60, false); sunDisc.position.copy(sunDir).multiplyScalar(220); group.add(sunDisc);
  const sun = new THREE.DirectionalLight(0xffb070, 1.6); sun.position.copy(sunDir).multiplyScalar(40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera; sc.left = sc.bottom = -9; sc.right = sc.top = 9; sc.near = 5; sc.far = 90;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight(0x6a5a8a, 0x3a2a20, 0.5));

  const street = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), asphalt); street.rotation.x = -Math.PI / 2; street.position.y = STREET_Y; street.receiveShadow = true; group.add(street);
  const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(11, 12), concrete); sidewalk.rotation.x = -Math.PI / 2; sidewalk.position.set(2, 0, -0.5); sidewalk.receiveShadow = true; group.add(sidewalk);
  const curbMat = std(0xe6d24a, 0.9);
  group.add(at(box(0.2, 0.1 - STREET_Y, 12, curbMat), -3.5, (STREET_Y + 0.02) / 2, -0.5), at(box(11.2, 0.1 - STREET_Y, 0.2, curbMat), 2, (STREET_Y + 0.02) / 2, 5.5));
  for (let i = 0; i < 9; i++) { const c = at(cyl(0.015, 0.015, 0.004, chrome, 8), -3.3 + rnd() * 0.3, 0.003, rr(-6, 5)); group.add(c); }   // tampinhas na sarjeta

  /* ---------- a fachada e o bar por dentro ---------- */
  const paint = std(0xffffff, 0.95, { map: paintTex('#e4b839', '#8a6a20') });
  const bar = new THREE.Group(); bar.position.z = -9.5; group.add(bar);   // frente em z = -6.5
  const W = 12, H = 4, D = 6, DOOR = 3.2, DOOR_H = 2.6;
  bar.add(at(box((W - DOOR) / 2, H, 0.3, paint), -(DOOR / 2 + (W - DOOR) / 4), H / 2, D / 2), at(box((W - DOOR) / 2, H, 0.3, paint), DOOR / 2 + (W - DOOR) / 4, H / 2, D / 2));
  bar.add(at(box(DOOR, H - DOOR_H, 0.3, paint), 0, DOOR_H + (H - DOOR_H) / 2, D / 2));
  const tiles = std(0xffffff, 0.5, { map: azulejoTex });
  for (const sx of [-1, 1]) bar.add(at(box((W - DOOR) / 2 - 0.1, 1.2, 0.03, tiles), sx * (DOOR / 2 + (W - DOOR) / 4), 0.6, D / 2 + 0.16));
  bar.add(at(box(0.3, H, D, paint), -W / 2, H / 2, 0), at(box(0.3, H, D, paint), W / 2, H / 2, 0), at(box(W, H, 0.3, paint), 0, H / 2, -D / 2), at(box(W, 0.25, D, roofMat), 0, H, 0));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x6a6058, 0.8, { map: azulejoTex })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; floor.receiveShadow = true; bar.add(floor);
  bar.add(at(box(W - 0.6, H - 0.25, 0.02, std(0x7a6a5a, 0.9, { map: azulejoTex })), 0, (H - 0.25) / 2, -D / 2 + 0.16));   // parede do fundo azulejada
  // porta de aço meio erguida
  bar.add(at(box(DOOR, 1.2, 0.05, std(0x777c80, 0.6, { map: corrugatedTex, metalness: 0.4 })), 0, DOOR_H - 0.6, D / 2 + 0.05));
  bar.add(at(cyl(0.18, 0.18, DOOR + 0.2, iron, 14), 0, DOOR_H + 0.15, D / 2 + 0.05).rotateZ(Math.PI / 2));
  // placa, lousa, lâmpada da porta
  bar.add(at(box(4.6, 0.8, 0.08, std(0xffffff, 0.8, { map: signTex })), 0, H - 0.6, D / 2 + 0.2));
  bar.add(at(box(0.5, 0.5, 0.03, std(0xffffff, 0.9, { map: chalkTex })), -2.3, 1.75, D / 2 + 0.18));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a0 })); bulb.position.set(0, 2.9, D / 2 + 0.25); bar.add(bulb);
  bar.add(at(new THREE.PointLight(0xffd08a, 1.6, 7, 2), 0, 2.85, D / 2 + 0.3));
  // balcão, geladeira, freezer, tubos, TV
  bar.add(at(box(4.5, 1.05, 0.6, std(0xc8b090, 0.6, { map: azulejoTex })), 0, 0.525, 0), at(box(4.6, 0.05, 0.7, std(0xe0dcd0, 0.35, { metalness: 0.2 })), 0, 1.07, 0));
  for (let i = 0; i < 9; i++) bar.add(at(cyl(0.03, 0.03, rr(0.22, 0.3), i % 3 ? amber : glassMat, 8), -2 + i * 0.5, 1.22, -0.05));   // garrafas no balcão
  const fridge = new THREE.Group(); fridge.position.set(3.2, 0, -D / 2 + 0.55); bar.add(fridge);
  fridge.add(at(box(0.7, 1.9, 0.7, std(0xf0f0ea, 0.5)), 0, 0.95, 0));
  const fridgeGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.6), new THREE.MeshStandardMaterial({ color: 0xcfe8ff, emissive: 0xcfe8ff, emissiveIntensity: 1.4, roughness: 0.2 })); fridgeGlass.position.set(0, 1.0, 0.36); fridge.add(fridgeGlass);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) fridge.add(at(cyl(0.035, 0.035, 0.22, amber, 8), -0.16 + i * 0.16, 0.35 + j * 0.4, 0.2));
  fridge.add(at(new THREE.PointLight(0xcfe8ff, 2.2, 6, 2), 0, 1.0, 0.6));
  bar.add(at(box(1.5, 0.85, 0.65, std(0xf5f5f0, 0.5)), -3.8, 0.425, -D / 2 + 0.5));   // freezer horizontal
  const tubeMats: THREE.MeshStandardMaterial[] = [];
  for (const z of [1.2, -1.2]) { const m = new THREE.MeshStandardMaterial({ color: 0xdff5e8, emissive: 0xdff5e8, emissiveIntensity: 2 }); tubeMats.push(m); bar.add(at(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.08), m), 0, H - 0.4, z)); }
  const tubeLight = at(new THREE.PointLight(0xdff5e8, 2.4, 9, 2), 0, H - 0.5, 0); bar.add(tubeLight);
  const tv = new THREE.Group(); tv.position.set(-4.8, 2.5, D / 2 - 0.6); tv.rotation.y = 0.7; bar.add(tv);
  tv.add(at(box(0.5, 0.42, 0.45, std(0x2a2a2e, 0.6)), 0, 0, 0), at(box(0.12, 0.08, 0.6, iron), 0, -0.26, -0.1));
  const screen = new THREE.MeshStandardMaterial({ color: 0x8ab4ff, emissive: 0x8ab4ff, emissiveIntensity: 1.2, roughness: 0.3 });
  tv.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.34), screen), 0, 0, 0.226));
  shadows(bar, (o) => o === bulb || o === fridgeGlass);
  // fora, encostado na fachada: engradados, cadeiras empilhadas, botijão
  const crate = (color: number) => { const g = new THREE.Group(); g.add(box(0.51, 0.315, 0.355, std(color, 0.7))); for (let i = 0; i < 6; i++) g.add(at(cyl(0.028, 0.028, 0.1, amber, 8), -0.18 + (i % 3) * 0.18, 0.18, -0.08 + Math.floor(i / 3) * 0.16)); return g; };
  [[0xf2c200, 0], [0xc0392b, 1], [0x1f4e9a, 2], [0xf2c200, 3], [0xc0392b, 4], [0x1f4e9a, 5]].forEach(([c, i]) => group.add(at(crate(c), 3.6 + (i % 2) * 0.55, 0.16 + Math.floor(i / 2) * 0.33, -6.1)));
  const gas = at(cyl(0.18, 0.18, 0.58, std(0x1f5fa8, 0.5, { metalness: 0.3 }), 16), 5.4, 0.29, -6.1); group.add(gas, at(box(0.04, 0.04, 0.5, iron), 5.4, 0.5, -6.3));

  /* ---------- muro pichado ---------- */
  const wallMat = std(0xffffff, 0.95, { map: wallTex });
  const wall = at(box(0.25, 2.2, 12.5, wallMat), 7.1, 1.1, -0.25); group.add(wall);
  for (let i = 0; i < 18; i++) group.add(at(box(0.05, rr(0.06, 0.12), 0.04, glassMat), 7.1 + rr(-0.08, 0.08), 2.24, -6.3 + i * 0.68));   // cacos no topo

  /* ---------- rua: poste, fios, Fusca, árvore, carrinho, orelhão ---------- */
  const poleMat = std(0x9a9a92, 1);
  const pole = (x: number, z: number) => group.add(at(cyl(0.1, 0.14, 8, poleMat, 10), x, 4 + STREET_Y, z));
  pole(-4.6, 3); pole(-4.6, -14);
  const lampHead = new THREE.Group(); lampHead.position.set(-4.6, 7.4, 3); group.add(lampHead);
  lampHead.add(at(box(1.6, 0.06, 0.06, iron), 0.8, 0, 0), at(box(0.5, 0.14, 0.24, iron), 1.5, -0.05, 0));
  const lampGlass = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.18), new THREE.MeshBasicMaterial({ color: 0xffb060 })); lampGlass.position.set(1.5, -0.13, 0); lampHead.add(lampGlass);
  const lampGlow = glow('255,154,46', 0.55, 2.2); lampGlow.position.set(1.5, -0.2, 0); lampHead.add(lampGlow);
  lampHead.add(at(new THREE.PointLight(0xff9a2e, 2.5, 12, 2), 1.5, -0.3, 0));
  const wireMat = new THREE.LineBasicMaterial({ color: 0x0a0a0c });
  for (let k = 0; k < 4; k++) {
    const pts: THREE.Vector3[] = [], a = new THREE.Vector3(-4.6 + rr(-0.1, 0.1), 7.2 - k * 0.22, 3), b = new THREE.Vector3(-4.6 + rr(-0.1, 0.1), 7.2 - k * 0.22, -14);
    for (let i = 0; i <= 16; i++) { const u = i / 16; pts.push(a.clone().lerp(b, u).setY(a.y - Math.sin(u * Math.PI) * (0.9 + k * 0.15))); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
  }
  const moths: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) { const m = glow('255,240,200', 0.9, 0.06); moths.push(m); lampHead.add(m); }
  anims.push((t) => moths.forEach((m, i) => { const a = t * (1.6 + i * 0.3) + i * 1.3; m.position.set(1.5 + Math.cos(a) * (0.25 + 0.1 * Math.sin(t * 3 + i)), -0.35 + Math.sin(a * 1.7) * 0.18, Math.sin(a) * 0.3); }));
  // Fusca
  const fusca = new THREE.Group(); fusca.position.set(-5.7, STREET_Y, -1.5); group.add(fusca);
  const beige = std(0xd9c9a1, 0.4, { metalness: 0.2 }), dark = std(0x0e1014, 0.2, { metalness: 0.4 });
  fusca.add(at(box(1.55, 0.5, 3.9, beige), 0, 0.55, 0));
  const roof = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), beige); roof.scale.set(0.78, 0.6, 1.5); roof.position.y = 0.8; fusca.add(roof);
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), dark); cabin.scale.set(0.79, 0.55, 1.2); cabin.position.y = 0.86; fusca.add(cabin);
  for (const sx of [-1, 1]) for (const sz of [-1.25, 1.25]) { const w = cyl(0.3, 0.3, 0.2, dark, 16); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.75, 0.3, sz); fusca.add(w); }
  for (const sx of [-1, 1]) fusca.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe8c0 })), sx * 0.55, 0.7, 1.96));
  shadows(fusca);
  // árvore caiada
  const tree = new THREE.Group(); tree.position.set(5.6, 0, 3.4); group.add(tree);
  tree.add(at(cyl(0.16, 0.2, 1.5, std(0xedebe0, 1), 10), 0, 0.75, 0), at(cyl(0.12, 0.16, 2.2, std(0x3a2e24, 1), 10), 0, 2.6, 0));
  const leaf = std(0x2f4a24, 1);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(rr(0.9, 1.3), 12, 10), leaf); s.position.set(rr(-0.9, 0.9), 3.6 + rr(-0.3, 0.6), rr(-0.9, 0.9)); tree.add(s); }
  shadows(tree);
  // carrinho de churrasquinho
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
  // varal de lâmpadas: do carrinho ao poste
  const bulbs: THREE.Sprite[] = [], bulbA = new THREE.Vector3(-1.9, 3.3, 3.9), bulbB = new THREE.Vector3(-4.5, 5.2, 3.1);
  for (let i = 1; i < 7; i++) { const b = glow('255,200,120', 0.9, 0.25); bulbs.push(b); group.add(b); }
  const bulbPts = new THREE.Float32BufferAttribute(13 * 3, 3).setUsage(THREE.DynamicDrawUsage);
  const bulbLine = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', bulbPts), wireMat); bulbLine.frustumCulled = false; group.add(bulbLine);
  const _p = new THREE.Vector3();
  anims.push((t) => {
    const sway = Math.sin(t * 0.8) * 0.06;
    for (let i = 0; i <= 12; i++) {
      const u = i / 12, sag = Math.sin(u * Math.PI);
      _p.lerpVectors(bulbA, bulbB, u); _p.x += sway * sag; _p.y -= sag * 0.45;
      bulbPts.setXYZ(i, _p.x, _p.y, _p.z);
      if (i % 2 === 0 && i >= 2 && i <= 12) bulbs[i / 2 - 1].position.set(_p.x, _p.y - 0.08, _p.z);
    }
    bulbPts.needsUpdate = true;
  });
  // orelhão
  const orelhao = new THREE.Group(); orelhao.position.set(6.4, 0, -3.2); group.add(orelhao);
  orelhao.add(at(cyl(0.04, 0.05, 1.6, iron, 8), 0, 0.8, 0));
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12, 0, Math.PI), std(0xf47b20, 0.5)); hood.material.side = THREE.DoubleSide; hood.position.set(0, 1.75, 0); hood.rotation.y = -Math.PI / 2; orelhao.add(hood);
  shadows(orelhao);

  /* ---------- prédios ao fundo ---------- */
  const facade = std(0xffffff, 0.95, { map: facadeTex, emissiveMap: facadeTex, emissive: 0xffffff, emissiveIntensity: 0.6 });
  const building = (w: number, h: number, d: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [facade, facade, roofMat, roofMat, facade, facade]); m.position.y = h / 2 + STREET_Y; return m; };
  for (let i = 0; i < 70; i++) {
    const a = rnd() * 6.283, r = rr(15, 40), w = rr(5, 10), d = rr(5, 10), h = rr(5, 14) + Math.max(0, r - 22) * rr(0.2, 0.7);
    const g = new THREE.Group(), p = polar(r, a); g.position.set(p.x, 0, p.z); g.rotation.y = rnd() * 6.283;
    g.add(building(w, h, d));
    if (rnd() < 0.4) g.add(at(box(0.5, rr(0.8, 2), 0.5, roofMat), rr(-w / 3, w / 3), h + 0.6 + STREET_Y, rr(-d / 3, d / 3)));   // caixa d'água
    group.add(g);
  }

  /* ---------- a mesa ---------- */
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R - 0.03, 0.04, 64), std(0xffffff, 0.55, { map: tableTex })); top.name = 'tableTop';
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
  const stack = new THREE.Group(); stack.position.set(-3.0, 0, -5.9); stack.rotation.y = 0.4; group.add(stack);
  for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.position.y = i * 0.08; stack.add(g); g.add(at(box(0.42, 0.04, 0.42, plastic), 0, 0.42 + i * 0.02, 0), at(box(0.42, 0.55, 0.04, plastic), 0, 0.72, 0.2)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.02, 0.022, 0.4, plastic, 8), sx * 0.17, 0.2, sz * 0.17)); }
  shadows(stack);

  /* ---------- em cima da mesa: só na borda, fora das cartas ---------- */
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
  for (const seat of [0, 1, 2, 3] as Seat[]) onTable(seatAngle(seat) + 0.45, 1.0, glass([0.5, 0.2, 0.7, 0][seat]));
  onTable(Math.PI / 4, 0.98, bottle(true)); onTable(Math.PI / 4 + 0.12, 1.06, bottle(true));
  const empty = bottle(false); onTable(5 * Math.PI / 4, 1.0, empty); empty.rotation.z = Math.PI / 2 - 0.05; empty.position.y = TABLE_TOP + 0.036;   // vazia, deitada na borda
  // cinzeiro, maço, isqueiro, fósforos (perto da cadeira 1, quem fuma)
  const ash = new THREE.Group(); ash.add(at(cyl(0.05, 0.04, 0.02, glassMat, 12), 0, 0.01, 0));
  for (let i = 0; i < 5; i++) ash.add(at(cyl(0.004, 0.004, 0.03, std(0xe8dcc0, 0.9), 6), rr(-0.02, 0.02), 0.022, rr(-0.02, 0.02)).rotateX(rr(-1.2, 1.2)));
  ash.add(at(cyl(0.025, 0.02, 0.008, std(0xb0a090, 1), 8), 0, 0.02, 0));
  onTable(7 * Math.PI / 4 - 0.1, 0.98, ash);
  onTable(7 * Math.PI / 4 + 0.08, 1.04, box(0.055, 0.022, 0.088, std(0xe30613, 0.6)), 0.4).position.y += 0.011;
  onTable(7 * Math.PI / 4 + 0.18, 0.96, cyl(0.012, 0.012, 0.08, std(0x0057b8, 0.5), 8), 0).rotation.set(Math.PI / 2, 0, 0.8);
  onTable(7 * Math.PI / 4 - 0.22, 1.02, box(0.053, 0.015, 0.036, std(0xf6c51b, 0.8)), 1.1).position.y += 0.008;
  // porção de fritas com molhos e amendoim (entre as cadeiras 0 e 1), guardanapos e paliteiro (entre 2 e 3)
  const plate = new THREE.Group();
  plate.add(at(cyl(0.12, 0.1, 0.015, std(0xf4f0e8, 0.5), 20), 0, 0.008, 0), at(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 6, 24), std(0x2f6b3a, 0.6)).rotateX(Math.PI / 2), 0, 0.016, 0));
  for (let i = 0; i < 16; i++) plate.add(at(box(0.012, 0.012, rr(0.04, 0.08), std(0xe8b84a, 0.7)), rr(-0.06, 0.06), 0.025, rr(-0.06, 0.06)).rotateY(rnd() * 3).rotateX(rr(-0.3, 0.3)));
  onTable(Math.PI / 4 - 0.35, 1.0, plate);
  for (let i = 0; i < 3; i++) onTable(Math.PI / 4 + 0.32 + i * 0.06, 1.04, box(0.04, 0.006, 0.07, std([0xc0272d, 0xf4d35e, 0xc0272d][i], 0.7)), rr(-0.4, 0.4)).position.y += 0.003;
  onTable(Math.PI / 4 - 0.55, 1.05, box(0.1, 0.12, 0.03, std(0xf4f0e8, 0.6)), 0).position.y += 0.06;   // saco de amendoim
  onTable(5 * Math.PI / 4 - 0.3, 1.02, box(0.1, 0.09, 0.05, std(0xf8f8f8, 0.9)), 0.3).position.y += 0.045;   // guardanapeiro
  onTable(5 * Math.PI / 4 + 0.3, 1.0, cyl(0.02, 0.02, 0.05, chrome, 10), 0).position.y += 0.025;   // paliteiro
  for (let i = 0; i < 7; i++) onTable(rr(0, 6.28), rr(0.95, 1.1), cyl(0.014, 0.014, 0.004, chrome, 8), 0).position.y += 0.002;   // tampinhas: placar
  // no chão: balde de gelo e isopor
  const bucket = new THREE.Group(); bucket.position.set(1.1, 0, 1.5); group.add(bucket);
  bucket.add(at(cyl(0.13, 0.1, 0.24, std(0xc0392b, 0.6), 14), 0, 0.12, 0));
  for (const [x, z, r] of [[-0.04, 0.02, 0.15], [0.05, -0.03, -0.2]]) { const b = bottle(true); b.position.set(x, 0.12, z); b.rotation.z = r; bucket.add(b); }
  const isopor = new THREE.Group(); isopor.position.set(1.6, 0, -0.9); isopor.rotation.y = 0.5; group.add(isopor);
  isopor.add(at(box(0.47, 0.33, 0.33, std(0xf5f5f0, 0.9)), 0, 0.165, 0), at(box(0.49, 0.03, 0.35, std(0xf5f5f0, 0.9)), 0, 0.345, 0), at(box(0.5, 0.02, 0.04, std(0x1f5fa8, 0.7)), 0, 0.35, 0));
  shadows(bucket); shadows(isopor);

  /* ---------- o vira-lata caramelo, debaixo da mesa ---------- */
  const dog = new THREE.Group(); dog.rotation.y = 0.6; group.add(dog);
  const fur = std(0xc48a3f, 0.95);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), fur); body.scale.set(1, 0.65, 1.8); body.position.y = 0.13; dog.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), fur); head.position.set(0, 0.16, 0.42); dog.add(head);
  dog.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), fur), 0, 0.12, 0.53), at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0x111111, 0.4)), 0, 0.13, 0.59));
  for (const sx of [-1, 1]) dog.add(at(box(0.05, 0.09, 0.02, fur), sx * 0.09, 0.25, 0.4).rotateZ(sx * 0.4));
  const tail = at(cyl(0.015, 0.03, 0.3, fur, 8), 0.12, 0.08, -0.4); tail.rotation.set(1.4, 0, 0.6); dog.add(tail);
  for (const sx of [-1, 1]) dog.add(at(cyl(0.035, 0.03, 0.28, fur, 8), sx * 0.15, 0.05, 0.25).rotateX(Math.PI / 2));
  shadows(dog);
  anims.push((t) => { body.scale.y = 0.65 * (1 + 0.03 * Math.sin(t * 1.4)); tail.rotation.z = 0.6 + Math.sin(t * 2.2) * 0.15; });

  /* ---------- luzes que vivem ---------- */
  anims.push((t) => {
    screen.emissiveIntensity = 0.9 + 0.35 * Math.sin(t * 9.3) * Math.sin(t * 2.1) + 0.2 * (rnd() - 0.5);
    const blink = Math.sin(t * 5.1) * Math.sin(t * 13.7) > 0.72 ? 0.2 : 2;   // um tubo pisca de vez em quando
    tubeMats[1].emissiveIntensity = blink; tubeLight.intensity = 1.6 + 0.4 * blink;
    lampGlow.material.opacity = 0.5 + 0.06 * Math.sin(t * 17);
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

  const scenery: Scenery = {
    id: 'bar', group, chairs,
    background: new THREE.Color(0x5a3a3a), fog: new THREE.FogExp2(0x6a4a44, 0.02), exposure: 1.0, walkMaxR: 6.4, deck,
    update(t, dt) { for (const a of anims) a(t, dt); },
    /** a calçada (x -3.5..7.5, z -6.5..5.5) fica no zero; a rua, um degrau abaixo */
    floorAt: (x, z) => (x >= -3.5 && x <= 7.5 && z >= -6.5 && z <= 5.5 ? 0 : STREET_Y),
    dispose() { disposeTree(group); deck.dispose(); },
  };
  return scenery;
};
