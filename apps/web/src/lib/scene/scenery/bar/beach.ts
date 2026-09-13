/**
 * A praia em volta do quiosque: a areia (plana até 6 m, descendo até o mar), o mar de uns 7 m em diante até o
 * horizonte (o perto ondula por vértice, o longe é chapado), a espuma e a faixa molhada onde ele encontra a areia,
 * os coqueiros, as gaivotas, o guarda-sol com duas cadeiras de praia, o barquinho puxado na areia, o castelo de
 * areia e as pegadas. O sol fica baixo sobre o mar; tudo aqui é procedural e tolera textura null (sem DOM).
 */
import * as THREE from 'three';
import { at, box, cyl, shadows, sph, speckle, tex, type Rng } from '../kit';

export type Anim = (t: number, dt: number) => void;
export interface Beach {
  /** altura da areia em (x, z): zero até x = 6, depois desce para o mar */
  sandH(x: number, z: number): number;
  /** ponto no tronco do coqueiro `i`, `u` ∈ [0, 1] da base à copa, em coordenadas do cenário */
  palmAt(i: number, u: number): THREE.Vector3;
}

/** A borda mais próxima do mar; a areia começa a descer em x = 6 e o nível do mar é -0.25 (linha d'água em x ≈ 9.3). */
export const SEA_X = 7.2;
const SEA_Y = -0.25;
const Y = new THREE.Vector3(0, 1, 0);

export function buildBeach(rng: Rng, group: THREE.Group, anims: Anim[]): Beach {
  const { rnd, rr } = rng;
  const std = (color: number | string, roughness = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const sandH = (x: number) => (x < 6 ? 0 : x < 10 ? -0.3 * (x - 6) / 4 : -0.3 - 0.08 * (x - 10));

  /* ---------- texturas ---------- */
  const sandTex = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#e6cfa0'; x.fillRect(0, 0, w, h);
    speckle(x, rng, w, h, 5000, ['#d4b986', '#f4e6c6', '#c6a672', '#b89a6a'], 0.6, 2.2, 0.15, 0.5);
    x.strokeStyle = 'rgba(120,95,60,.10)'; x.lineWidth = 3;   // marolas do vento
    for (let j = 0; j < 22; j++) { x.beginPath(); for (let i = 0; i <= w; i += 8) { const yy = j * 24 + Math.sin(i * 0.05 + j) * 6 + Math.sin(i * 0.013) * 4; i ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke(); }
    x.strokeStyle = 'rgba(255,240,210,.10)'; x.lineWidth = 2;
    for (let j = 0; j < 22; j++) { x.beginPath(); for (let i = 0; i <= w; i += 8) { const yy = j * 24 + 8 + Math.sin(i * 0.05 + j) * 6 + Math.sin(i * 0.013) * 4; i ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke(); }
  }, { repeat: 40 });
  const seaTex = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#2a7f95'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 40; j++) {
      x.strokeStyle = j % 3 ? 'rgba(120,200,215,.35)' : 'rgba(20,70,90,.35)'; x.lineWidth = rr(1, 3); x.beginPath();
      for (let i = 0; i <= w; i += 6) { const yy = j * 13 + Math.sin(i * 0.04 + j * 1.7) * 5 + Math.sin(i * 0.11 + j) * 2; i ? x.lineTo(i, yy) : x.moveTo(i, yy); }
      x.stroke();
    }
    speckle(x, rng, w, h, 120, ['#e8f6f8'], 1, 3, 0.2, 0.6);   // espuminha
  }, { repeat: [10, 16] });
  const foamTex = tex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${rr(0.3, 0.9)})`; x.beginPath(); x.ellipse(rr(0, w), rr(0, h), rr(4, 18), rr(2, 8), rnd() * 3, 0, 7); x.fill(); }
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = g; x.fillRect(0, 0, w, h);
  }, { repeat: [1, 24] });
  const wetTex = tex(64, 4, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(140,110,70,0)'); g.addColorStop(0.5, 'rgba(140,110,70,.6)'); g.addColorStop(1, 'rgba(140,110,70,.8)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const frondTex = tex(128, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#3f7a2c'; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w, h * 0.35); x.lineTo(w * 0.62, h); x.lineTo(w * 0.38, h); x.lineTo(0, h * 0.35); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(20,50,15,.6)'; x.lineWidth = 3;
    for (let yy = 20; yy < h; yy += 14) { x.beginPath(); x.moveTo(w / 2, yy); x.lineTo(0, yy + 34); x.moveTo(w / 2, yy); x.lineTo(w, yy + 34); x.stroke(); }
    x.strokeStyle = '#a8c840'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
  });
  const barkTex = tex(128, 256, (x, w, h) => {
    x.fillStyle = '#8a7358'; x.fillRect(0, 0, w, h);
    for (let yy = 0; yy < h; yy += 18) { x.fillStyle = 'rgba(40,30,20,.45)'; x.fillRect(0, yy, w, 5); x.fillStyle = 'rgba(255,240,220,.12)'; x.fillRect(0, yy + 6, w, 3); }
    speckle(x, rng, w, h, 200, ['#5a4a38', '#a89070'], 1, 4, 0.1, 0.4);
  }, { repeat: [3, 2] });
  const footTex = tex(64, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(120,95,60,.5)';
    x.beginPath(); x.ellipse(w / 2, h * 0.62, w * 0.3, h * 0.3, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(w / 2, h * 0.35, w * 0.34, h * 0.16, 0, 0, 7); x.fill();
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(w * 0.2 + i * w * 0.15, h * 0.16 + Math.abs(i - 1) * 4, 4 - i * 0.4, 0, 7); x.fill(); }
  });
  const stripeTex = (a: string, b: string) => tex(64, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? a : b; x.fillRect(i * 8, 0, 8, h); } }, { repeat: [3, 1] });

  /* ---------- a areia: um relevo que desce para o mar, e a terra chapada bem longe ---------- */
  const sandMat = std(0xffffff, 1, { map: sandTex, bumpMap: sandTex, bumpScale: 0.02 });
  const sandGeo = new THREE.PlaneGeometry(90, 240, 60, 160); sandGeo.rotateX(-Math.PI / 2); sandGeo.translate(-15, 0, 0);
  const sp = sandGeo.attributes.position; for (let i = 0; i < sp.count; i++) sp.setY(i, sandH(sp.getX(i))); sandGeo.computeVertexNormals();
  const sand = new THREE.Mesh(sandGeo, sandMat); sand.name = 'sand'; sand.receiveShadow = true; group.add(sand);
  const land = new THREE.Mesh(new THREE.PlaneGeometry(300, 400), sandMat); land.rotation.x = -Math.PI / 2; land.position.set(-210, -0.01, 0); group.add(land);

  /* ---------- o mar: perto ondula, longe é chapado; e onde toca a areia, espuma ---------- */
  const seaMat = std(0xffffff, 0.28, { map: seaTex, metalness: 0.08 });
  const seaGeo = new THREE.PlaneGeometry(40, 70, 40, 70); seaGeo.rotateX(-Math.PI / 2); seaGeo.translate(SEA_X + 20, 0, 0);
  const sea = new THREE.Mesh(seaGeo, seaMat); sea.name = 'sea'; sea.position.y = SEA_Y; sea.receiveShadow = true; group.add(sea);
  const seaFar = new THREE.Mesh(new THREE.PlaneGeometry(283, 300), seaMat); seaFar.rotation.x = -Math.PI / 2; seaFar.position.set(SEA_X + 141.5, SEA_Y - 0.03, 0); seaFar.name = 'seaFar'; group.add(seaFar);
  const base = (seaGeo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array, vp = seaGeo.attributes.position as THREE.BufferAttribute;
  anims.push((t) => {
    for (let i = 0; i < vp.count; i++) {
      const X = base[i * 3], Z = base[i * 3 + 2], damp = Math.min(1, 0.35 + (X - SEA_X) / 6);
      vp.setY(i, damp * (0.06 * Math.sin(X * 1.4 - t * 1.6) + 0.04 * Math.sin(X * 0.7 + Z * 0.9 - t * 1.1) + 0.02 * Math.sin(Z * 2.3 + t * 2.0)));
    }
    vp.needsUpdate = true; seaGeo.computeVertexNormals();
    if (seaTex) { seaTex.offset.y += 0.0002; seaTex.offset.x = Math.sin(t * 0.3) * 0.01; }
  });
  const slope = Math.atan(0.075);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 70), std(0x8c6e46, 0.5, { map: wetTex, transparent: true, opacity: wetTex ? 1 : 0.45, depthWrite: false }));
  wet.rotation.order = 'ZYX'; wet.rotation.set(-Math.PI / 2, 0, -slope); wet.position.set(9.3, sandH(9.3) + 0.006, 0); group.add(wet);   // deitada e depois tombada com a areia
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: foamTex, transparent: true, opacity: 0.6, depthWrite: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 70), foamMat); foam.rotation.order = 'ZYX'; foam.rotation.set(-Math.PI / 2, 0, -slope); foam.name = 'foam'; group.add(foam);
  anims.push((t) => {
    const x = 9.3 + 0.6 * Math.sin(t * 1.1) + 0.15 * Math.sin(t * 2.7);
    foam.position.set(x, sandH(x) + 0.012, 0); foamMat.opacity = 0.35 + 0.3 * Math.max(0, Math.cos(t * 1.1));
    if (foamTex) foamTex.offset.y = t * 0.01;
  });

  /* ---------- coqueiros: tronco curvo em gomos, copa de folhas dobradas, cocos ---------- */
  const bark = std(0xffffff, 0.95, { map: barkTex }), frondMat = std(0x3f7a2c, 0.8, { map: frondTex, alphaTest: frondTex ? 0.5 : 0, side: THREE.DoubleSide });
  const frondGeo = new THREE.PlaneGeometry(0.6, 2.8, 2, 10); frondGeo.rotateX(Math.PI / 2); frondGeo.translate(0, 0, 1.4);
  { const p = frondGeo.attributes.position; for (let i = 0; i < p.count; i++) { const u = p.getZ(i) / 2.8; p.setY(i, 0.5 * u - 1.3 * u * u - (Math.abs(p.getX(i)) > 0.01 ? 0.07 : 0)); } frondGeo.computeVertexNormals(); }
  const palms: { base: THREE.Vector3; curve: THREE.QuadraticBezierCurve3 }[] = [], crowns: { g: THREE.Group; ph: number }[] = [];
  const palm = (x: number, z: number, h: number, lean: number, leanDir: number) => {
    const g = new THREE.Group(); g.position.set(x, sandH(x), z); group.add(g);
    const top = new THREE.Vector3(Math.sin(leanDir) * lean, h, Math.cos(leanDir) * lean);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(top.x * 0.2, h * 0.55, top.z * 0.2), top); palms.push({ base: g.position, curve });
    const N = 9, dir = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const p0 = curve.getPoint(i / N), p1 = curve.getPoint((i + 1) / N); dir.subVectors(p1, p0);
      const c = cyl(0.2 - 0.08 * (i + 1) / N, 0.2 - 0.08 * i / N, dir.length() + 0.02, bark, 10);
      c.position.lerpVectors(p0, p1, 0.5); c.quaternion.setFromUnitVectors(Y, dir.normalize()); g.add(c);
    }
    const crown = new THREE.Group(); crown.position.copy(top); g.add(crown); crowns.push({ g: crown, ph: rnd() * 6.28 });
    const n = 9 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const f = new THREE.Mesh(frondGeo, frondMat); f.castShadow = true; f.rotation.order = 'YXZ';
      f.rotation.y = k * Math.PI * 2 / n + rr(-0.2, 0.2); f.rotation.x = k % 2 ? rr(-0.55, -0.25) : rr(0.0, 0.3); f.scale.setScalar(rr(0.85, 1.1)); crown.add(f);
    }
    for (let k = 0; k < 4; k++) crown.add(at(sph(rr(0.08, 0.11), std(k % 2 ? 0x6a8a2a : 0x8a6a3a, 0.7), 10), rr(-0.16, 0.16), -0.12, rr(-0.16, 0.16)));
    shadows(g, (o) => o.geometry === frondGeo);
    return g;
  };
  palm(-5.2, 3.0, 5.5, 0.9, 1.4); palm(5.2, -5.4, 6.2, 1.1, 1.9); palm(-6.4, -3.6, 4.8, 0.7, 0.9); palm(7.0, 5.4, 5.2, 1.2, 1.2); palm(-9.5, 9.5, 6.6, 1.0, 1.6);
  anims.push((t) => { for (const c of crowns) { c.g.rotation.z = 0.035 * Math.sin(t * 0.6 + c.ph); c.g.rotation.x = 0.025 * Math.sin(t * 0.45 + c.ph * 2); } });

  /* ---------- gaivotas: cinco planando em círculos sobre o mar ---------- */
  const gullMat = std(0xf4f4f0, 0.9, { side: THREE.DoubleSide }), tipMat = std(0x2a2a2a, 0.9, { side: THREE.DoubleSide });
  const gulls: { g: THREE.Group; wings: THREE.Mesh[]; cx: number; cz: number; r: number; h: number; speed: number; ph: number; flap: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group(); group.add(g);
    const b = sph(0.09, gullMat, 10); b.scale.set(0.9, 0.8, 2.2); b.castShadow = false; g.add(b);
    g.add(at(sph(0.06, gullMat, 8), 0, 0.05, 0.2), at(cyl(0.005, 0.02, 0.08, std(0xf0a030, 0.6), 6), 0, 0.04, 0.3).rotateX(Math.PI / 2));
    const wings: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.2), gullMat); w.geometry.translate(s * 0.375, 0, 0); w.geometry.rotateX(-Math.PI / 2); g.add(w); wings.push(w);   // deitada; bate em z
      const tip = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.14), tipMat); tip.position.set(s * 0.68, 0.001, 0); tip.rotation.x = -Math.PI / 2; w.add(tip);
    }
    gulls.push({ g, wings, cx: rr(10, 22), cz: rr(-14, 14), r: rr(3, 8), h: rr(5, 11), speed: rr(0.25, 0.5) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28, flap: rr(3, 5) });
  }
  anims.push((t) => {
    for (const c of gulls) {
      const a = t * c.speed + c.ph, glide = 0.15 + 0.85 * Math.max(0, Math.sin(t * 0.35 + c.ph));
      c.g.position.set(c.cx + Math.cos(a) * c.r, c.h + Math.sin(t * 0.6 + c.ph) * 0.5, c.cz + Math.sin(a) * c.r);
      c.g.rotation.y = -a + (c.speed > 0 ? 0 : Math.PI);
      c.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(t * c.flap + c.ph) * 0.55 * glide); });
    }
  });

  /* ---------- guarda-sol com duas cadeiras de praia, olhando o mar ---------- */
  {
    const wood = std(0xa8783c, 0.8), white = std(0xf6f2e8, 0.7), red = std(0xd63a2f, 0.7);
    const u = new THREE.Group(); u.position.set(5.0, 0, 3.4); u.rotation.z = -0.12; group.add(u);
    u.add(at(cyl(0.02, 0.026, 2.2, wood, 8), 0, 1.1, 0));
    for (let i = 0; i < 8; i++) { const w = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.4, 8, 1, true, i * Math.PI / 4, Math.PI / 4), i % 2 ? red : white); (w.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; w.position.y = 2.0; w.castShadow = true; u.add(w); }
    u.add(at(sph(0.04, wood, 8), 0, 2.22, 0));
    const chair = (color: string) => {
      const map = stripeTex(color, '#f6f2e8'), g = new THREE.Group(), cloth = std(map ? 0xffffff : color, 0.8, { map });
      g.add(at(box(0.5, 0.02, 0.48, cloth), 0, 0.32, 0));
      const back = at(box(0.5, 0.55, 0.02, cloth), 0, 0.557, -0.37); back.rotation.x = -0.5; g.add(back);
      for (const sx of [-1, 1]) { g.add(at(box(0.04, 0.03, 0.55, wood), sx * 0.27, 0.5, -0.02)); for (const z of [-0.2, 0.2]) g.add(at(cyl(0.018, 0.018, 0.32, wood, 6), sx * 0.24, 0.16, z)); }
      shadows(g); return g;
    };
    group.add(at(chair('#1f6fd1'), 4.6, 0, 2.7).rotateY(Math.PI / 2 + 0.15), at(chair('#e0402a'), 4.6, 0, 4.1).rotateY(Math.PI / 2 - 0.2));
  }

  /* ---------- o barquinho, puxado na areia com a proa para o mar ---------- */
  {
    const hullMat = std(0x2456a8, 0.6), inner = std(0xb08a5a, 0.85, { side: THREE.BackSide }), white = std(0xf4f0e6, 0.6), wood = std(0x8a6a3a, 0.85);
    const b = new THREE.Group(); b.position.set(6.2, sandH(6.2) + 0.42, -3.0); b.rotation.order = 'YXZ'; b.rotation.set(0.06, Math.PI / 2, 0); b.name = 'boat'; group.add(b);   // proa em +x, um tico para baixo
    const hullGeo = new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, hullMat); hull.scale.set(0.65, 0.45, 1.8); b.add(hull);
    const lining = new THREE.Mesh(hullGeo, inner); lining.scale.set(0.61, 0.42, 1.75); b.add(lining);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 40), wood); rim.rotation.x = Math.PI / 2; rim.scale.set(0.65, 1.8, 1); b.add(rim);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 40), white); stripe.rotation.x = Math.PI / 2; stripe.position.y = -0.12; stripe.scale.set(0.65 * 0.963, 1.8 * 0.963, 1); b.add(stripe);
    for (const z of [-0.7, 0.6]) b.add(at(box(1.15, 0.04, 0.22, wood), 0, -0.1, z));
    for (const sx of [-0.2, 0.25]) b.add(at(cyl(0.02, 0.02, 2.4, wood, 6), sx, -0.15, 0.2).rotateX(Math.PI / 2 - 0.08));
    b.add(at(cyl(0.05, 0.05, 0.4, wood, 8), 0, 0.15, 1.85).rotateX(0.4));   // a proa saliente
    shadows(b);
  }

  /* ---------- longe: um castelo de areia, e pegadas do quiosque até o guarda-sol ---------- */
  {
    const wetSand = std(0xc9a874, 1), c = new THREE.Group(); c.position.set(5.8, 0, 8.5); c.rotation.y = 0.4; group.add(c);
    c.add(at(cyl(0.6, 0.78, 0.3, wetSand, 20), 0, 0.15, 0), at(cyl(0.22, 0.26, 0.55, wetSand, 12), 0, 0.57, 0), at(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 12), wetSand), 0, 0.95, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.add(at(cyl(0.12, 0.14, 0.45, wetSand, 10), sx * 0.38, 0.5, sz * 0.38), at(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.14, 10), wetSand), sx * 0.38, 0.8, sz * 0.38));
    c.add(at(cyl(0.005, 0.005, 0.3, std(0x6a5a4a, 0.8), 5), 0, 1.15, 0), at(box(0.09, 0.05, 0.005, std(0xd63a2f, 0.7)), 0.045, 1.26, 0));
    const moat = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.1, 6, 28), std(0xb08a5a, 1)); moat.rotation.x = Math.PI / 2; moat.scale.z = 0.2; c.add(moat);
    shadows(c);
    const footMat = new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false });
    const from = new THREE.Vector3(0.6, 0, -6.2), to = new THREE.Vector3(4.6, 0, 3.0), d = to.clone().sub(from), n = Math.round(d.length() / 0.6), side = new THREE.Vector3(-d.z, 0, d.x).normalize();
    for (let i = 0; i <= n; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.27), footMat); f.visible = !!footTex; f.rotation.order = 'YXZ';
      f.position.lerpVectors(from, to, i / n).addScaledVector(side, i % 2 ? 0.12 : -0.12).setY(0.004);
      f.rotation.set(-Math.PI / 2, Math.atan2(-d.x, -d.z), 0); group.add(f);
    }
  }

  return { sandH: (x) => sandH(x), palmAt: (i, u) => palms[i].curve.getPoint(u).add(palms[i].base) };
}
