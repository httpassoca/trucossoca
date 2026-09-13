/**
 * Peças de molho do boneco. Cada construtora recebe `ctx` (fábrica de materiais, raio do corpo por altura,
 * alturas-chave) e devolve um Object3D para pendurar numa vaga. Uma peça nova é uma chave nova aqui; os molhos
 * apontam para as peças pela chave.
 */
import * as THREE from 'three';

export interface PartOptions { kind?: string; color?: string; accent?: string; accent2?: string; side?: 'L' | 'R'; colors?: string[] }
export interface PartCtx {
  mat: (name: string, color: string, roughness?: number, extra?: THREE.MeshStandardMaterialParameters) => THREE.MeshStandardMaterial;
  bodyRadiusAt: (y: number) => number;
  H: number; eyeY: number; mouthY: number; rEyes: number;
  skinMat: THREE.Material;
}
export type PartBuilder = (ctx: PartCtx, o: PartOptions) => THREE.Group;
export type TopBuilder = (ctx: PartCtx, o: PartOptions) => { body: THREE.Group; sleeves: THREE.Group[] | null };
export type PropBuilder = (ctx: PartCtx, o: PartOptions) => { obj: THREE.Group; upright: boolean };
export type ShoeBuilder = (ctx: PartCtx, o: PartOptions, side: -1 | 1) => THREE.Group;

const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const DS = { side: THREE.DoubleSide } as const;

/** Casca de duas paredes abraçando o corpo entre y0 e y1, com uma abertura opcional na frente (radianos). */
function shell(ctx: PartCtx, y0: number, y1: number, thick: number, gap: number, mat: THREE.Material, offset = 0.006) {
  const pts: THREE.Vector2[] = [], n = 16;
  for (let i = 0; i <= n; i++) { const y = y0 + (y1 - y0) * i / n; pts.push(V2(ctx.bodyRadiusAt(y) + thick, y)); }
  for (let i = n; i >= 0; i--) { const y = y0 + (y1 - y0) * i / n; pts.push(V2(ctx.bodyRadiusAt(y) + offset, y)); }
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 56, gap / 2, Math.PI * 2 - gap), mat);
}
const mesh = (name: string, geo: THREE.BufferGeometry, mat: THREE.Material, parent?: THREE.Object3D) => { const m = new THREE.Mesh(geo, mat); m.name = name; parent?.add(m); return m; };
const grp = (name: string, parent?: THREE.Object3D) => { const g = new THREE.Group(); g.name = name; parent?.add(g); return g; };

// ---------------------------------------------------------------- chapéus (sentam na coroa, y≈1.40)
export const HATS: Record<string, PartBuilder> = {
  gaucho(ctx, o) {
    const g = grp('hat_gaucho'), felt = ctx.mat('hatFelt', o.color ?? '#2a2420', .7), band = ctx.mat('hatBand', o.accent ?? '#c8322b', .6);
    g.position.y = 1.395;
    mesh('brim', new THREE.CylinderGeometry(0.44, 0.44, 0.014, 48), felt, g);
    const crown = mesh('crown', new THREE.CylinderGeometry(0.22, 0.245, 0.13, 40), felt, g); crown.position.y = 0.07;
    const top = mesh('crownTop', new THREE.SphereGeometry(0.22, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), felt, g); top.position.y = 0.135; top.scale.y = 0.35;
    const b = mesh('band', new THREE.CylinderGeometry(0.25, 0.25, 0.035, 40), band, g); b.position.y = 0.025;
    return g;
  },
  cowboy(ctx, o) {
    const g = grp('hat_pantaneiro'), straw = ctx.mat('hatStraw', o.color ?? '#c9a46a', .85), band = ctx.mat('hatBand', o.accent ?? '#3a2a1e', .6);
    g.position.y = 1.395;
    const brim = mesh('brim', new THREE.CylinderGeometry(0.40, 0.40, 0.014, 48), straw, g); brim.scale.set(0.92, 1, 1.05);
    for (const s of [-1, 1]) { const curl = mesh('brimCurl', new THREE.CylinderGeometry(0.028, 0.028, 0.50, 16), straw, g); curl.rotation.x = Math.PI / 2; curl.position.set(s * 0.355, 0.03, -0.02); }
    const crown = mesh('crown', new THREE.CylinderGeometry(0.20, 0.235, 0.17, 40), straw, g); crown.position.y = 0.09;
    const top = mesh('crownTop', new THREE.SphereGeometry(0.20, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), straw, g); top.position.y = 0.175; top.scale.y = 0.3;
    const b = mesh('band', new THREE.CylinderGeometry(0.242, 0.242, 0.03, 40), band, g); b.position.y = 0.02;
    return g;
  },
  straw(ctx, o) {          // chapéu de palha: aba cônica larga
    const g = grp('hat_palha'), straw = ctx.mat('hatStraw', o.color ?? '#d8b46a', .9), band = ctx.mat('hatBand', o.accent ?? '#c8322b', .6);
    g.position.y = 1.39;
    const brim = mesh('brim', new THREE.ConeGeometry(0.46, 0.09, 48, 1, true), ctx.mat('hatStraw', o.color ?? '#d8b46a', .9, DS), g); brim.position.y = 0.045;
    const crown = mesh('crown', new THREE.CylinderGeometry(0.19, 0.22, 0.12, 40), straw, g); crown.position.y = 0.12;
    const top = mesh('crownTop', new THREE.SphereGeometry(0.19, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), straw, g); top.position.y = 0.18; top.scale.y = 0.35;
    const b = mesh('band', new THREE.CylinderGeometry(0.225, 0.225, 0.028, 40), band, g); b.position.y = 0.085;
    return g;
  },
  leather(ctx, o) {        // chapéu de couro (cangaceiro): copa abaulada, aba da frente virada, estrela e medalhas
    const g = grp('hat_couro'), hide = ctx.mat('hatLeather', o.color ?? '#8a5a2b', .75), brass = ctx.mat('brass', '#e0b64a', .35, { metalness: .3 });
    g.position.y = 1.395;
    const crown = mesh('crown', new THREE.SphereGeometry(0.245, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), hide, g); crown.scale.y = 0.85;
    mesh('brimBack', new THREE.CylinderGeometry(0.31, 0.31, 0.014, 48, 1, false, Math.PI * 0.7, Math.PI * 1.6), hide, g);
    const front = mesh('brimFront', new THREE.CylinderGeometry(0.27, 0.27, 0.014, 32, 1, false, -Math.PI * 0.3, Math.PI * 0.6), hide, g);
    front.rotation.x = -1.35; front.position.set(0, 0.06, 0.20);
    const star = mesh('star', new THREE.CylinderGeometry(0.045, 0.045, 0.012, 5), brass, g); star.rotation.x = 1.35 - Math.PI / 2; star.position.set(0, 0.245, 0.25);
    for (let i = -1; i <= 1; i += 2) { const coin = mesh('medal', new THREE.CylinderGeometry(0.02, 0.02, 0.01, 16), brass, g); coin.rotation.x = 1.35 - Math.PI / 2; coin.position.set(i * 0.10, 0.19, 0.24); }
    return g;
  },
  cap(ctx, o) {
    const g = grp('hat_bone'), cloth = ctx.mat('capCloth', o.color ?? '#1f6fd1', .7);
    g.position.y = 1.39;
    const dome = mesh('dome', new THREE.SphereGeometry(0.245, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), cloth, g); dome.scale.y = 0.75;
    const visor = mesh('visor', new THREE.CylinderGeometry(0.26, 0.26, 0.014, 32, 1, false, -Math.PI * 0.35, Math.PI * 0.7), cloth, g); visor.position.set(0, 0.0, 0.10); visor.rotation.x = 0.15;
    return g;
  },
  headband(ctx, o) {       // Parintins: metade vermelha (Garantido), metade azul (Caprichoso)
    const g = grp('headband');
    g.position.y = 1.395;
    const a = mesh('bandA', new THREE.TorusGeometry(0.205, 0.03, 12, 32, Math.PI), ctx.mat('bandRed', o.color ?? '#d62828', .6), g); a.rotation.x = Math.PI / 2;
    const b = mesh('bandB', new THREE.TorusGeometry(0.205, 0.03, 12, 32, Math.PI), ctx.mat('bandBlue', o.accent ?? '#1d4ed8', .6), g); b.rotation.x = Math.PI / 2; b.rotation.z = Math.PI;
    return g;
  },
};

// ---------------------------------------------------------------- cabelos (calota na coroa, y≈1.36–1.45)
export const HAIR: Record<string, PartBuilder> = {
  flat(ctx, o) {           // repartido de lado, penteado
    const g = grp('hair_flat'), h = ctx.mat('hair', o.color ?? '#3b2a1e', .8);
    const cap = mesh('cap', new THREE.SphereGeometry(0.245, 40, 20), h, g); cap.scale.set(1, 0.5, 1); cap.position.set(0, 1.355, -0.02);
    const bang = mesh('bang', new THREE.SphereGeometry(0.10, 24, 16), h, g); bang.scale.set(1.4, 0.45, 0.7); bang.position.set(0.10, 1.40, 0.19); bang.rotation.z = -0.25;
    return g;
  },
  curly(ctx, o) {
    const g = grp('hair_curly'), h = ctx.mat('hair', o.color ?? '#2b1d14', .85), geo = new THREE.SphereGeometry(0.095, 20, 14);
    const pts: [number, number, number][] = [[0, 1.46, 0], [0.13, 1.43, 0.12], [-0.13, 1.43, 0.12], [0.16, 1.41, -0.08], [-0.16, 1.41, -0.08], [0, 1.43, -0.17], [0.07, 1.42, 0.2], [-0.07, 1.42, 0.2], [0.2, 1.36, 0.02], [-0.2, 1.36, 0.02], [0, 1.37, -0.22]];
    pts.forEach((p, i) => { const c = mesh('curl' + i, geo, h, g); c.position.set(...p); c.scale.setScalar(0.9 + (i % 3) * 0.1); });
    return g;
  },
  spiky(ctx, o) {
    const g = grp('hair_spiky'), h = ctx.mat('hair', o.color ?? '#1e1a17', .8);
    const cap = mesh('cap', new THREE.SphereGeometry(0.235, 40, 20), h, g); cap.scale.set(1, 0.45, 1); cap.position.set(0, 1.36, 0);
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.5; const s = mesh('spike' + i, new THREE.ConeGeometry(0.055, 0.17, 12), h, g); s.position.set(Math.sin(a) * 0.14, 1.47, Math.cos(a) * 0.14 - 0.04); s.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); }
    return g;
  },
  buzz(ctx, o) {
    const g = grp('hair_buzz'), h = ctx.mat('hair', o.color ?? '#4a3527', .9);
    const cap = mesh('cap', new THREE.SphereGeometry(0.232, 40, 20), h, g); cap.scale.set(1, 0.48, 1); cap.position.set(0, 1.355, -0.01);
    return g;
  },
  long(ctx, o) {           // liso, cai pelos ombros dos lados e atrás
    const g = grp('hair_long'), h = ctx.mat('hair', o.color ?? '#1a1412', .75);
    const cap = mesh('cap', new THREE.SphereGeometry(0.25, 40, 20), h, g); cap.scale.set(1, 0.5, 1); cap.position.set(0, 1.355, -0.02);
    const back = mesh('back', new THREE.CylinderGeometry(0.29, 0.45, 0.42, 32, 1, true, Math.PI * 0.6, Math.PI * 0.8), ctx.mat('hair', o.color ?? '#1a1412', .75, DS), g); back.position.set(0, 1.13, 0.0);
    return g;
  },
  bun(ctx, o) {
    const g = HAIR.buzz(ctx, o); g.name = 'hair_bun';
    const bun = mesh('bun', new THREE.SphereGeometry(0.09, 24, 16), ctx.mat('hair', o.color ?? '#4a3527', .9), g); bun.position.set(0, 1.44, -0.16);
    return g;
  },
};

// ---------------------------------------------------------------- barbas
function stache(ctx: PartCtx, o: PartOptions, r: number, wide: number) {
  const g = grp('mustache'), h = ctx.mat('facialHair', o.color ?? '#3b2a1e', .85);
  const y = ctx.mouthY + 0.055, z = ctx.bodyRadiusAt(y) + 0.006;
  for (const s of [-1, 1]) { const m = mesh('stache' + (s < 0 ? 'L' : 'R'), new THREE.SphereGeometry(r, 20, 14), h, g); m.scale.set(wide, 0.42, 0.4); m.position.set(s * r * 0.9 * wide, y, z); m.rotation.z = s * 0.28; }
  return g;
}
export const FACIAL_HAIR: Record<string, PartBuilder> = {
  mustache(ctx, o) { return stache(ctx, o, 0.048, 1); },
  thickMustache(ctx, o) { return stache(ctx, o, 0.068, 1.25); },
  goatee(ctx, o) {
    const g = grp('goatee'), h = ctx.mat('facialHair', o.color ?? '#3b2a1e', .85);
    const y = ctx.mouthY - 0.10, m = mesh('goatee', new THREE.SphereGeometry(0.05, 20, 14), h, g); m.scale.set(1, 1.1, 0.4); m.position.set(0, y, ctx.bodyRadiusAt(y) + 0.004);
    return g;
  },
  beard(ctx, o) {
    const g = FACIAL_HAIR.thickMustache(ctx, o); g.name = 'beard';
    const y = ctx.mouthY - 0.08, r = ctx.bodyRadiusAt(y);
    const b = mesh('beard', new THREE.TorusGeometry(0.17, 0.05, 12, 24, Math.PI * 1.1), ctx.mat('facialHair', o.color ?? '#3b2a1e', .85), g);
    b.rotation.z = Math.PI + Math.PI * 0.05; b.position.set(0, y + 0.06, r - 0.02); b.scale.z = 0.7;
    return g;
  },
};

// ---------------------------------------------------------------- óculos
function glasses(ctx: PartCtx, o: PartOptions, lensMat: THREE.Material, depth: number, round = false) {
  const g = grp('glasses'), frame = ctx.mat('frame', o.accent ?? '#15161a', .4);
  for (const s of [-1, 1]) {
    const a = s * 0.28, base = new THREE.Vector3(s * 0.165, ctx.eyeY + 0.03, ctx.rEyes * 0.90), dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const lg = grp('lens' + (s < 0 ? 'L' : 'R'), g); lg.position.copy(base).addScaledVector(dir, 0.10); lg.rotation.y = a;
    const lens = mesh('lens', new THREE.CylinderGeometry(0.10, 0.10, depth, 28), lensMat, lg); lens.rotation.x = Math.PI / 2; lens.scale.y = round ? 1 : 0.95;
    if (round) mesh('rim', new THREE.TorusGeometry(0.10, 0.008, 8, 28), frame, lg);
  }
  const bridge = mesh('bridge', new THREE.BoxGeometry(0.06, 0.016, 0.016), frame, g); bridge.position.set(0, ctx.eyeY + 0.05, ctx.rEyes * 0.90 + 0.10);
  for (const s of [-1, 1]) { const arm = mesh('temple', new THREE.BoxGeometry(0.012, 0.012, 0.26), frame, g); arm.position.set(s * 0.31, ctx.eyeY + 0.05, ctx.rEyes * 0.90 - 0.06); arm.rotation.y = s * 0.28; }
  return g;
}
export const EYEWEAR: Record<string, PartBuilder> = {
  sunglasses(ctx, o) { return glasses(ctx, o, ctx.mat('lensDark', o.color ?? '#15161a', .25), 0.035); },
  roundGlasses(ctx, o) { return glasses(ctx, o, ctx.mat('lensClear', o.color ?? '#9fd3e6', .1, { transparent: true, opacity: .45 }), 0.012, true); },
};

// ---------------------------------------------------------------- pescoço
export const NECK: Record<string, PartBuilder> = {
  bandana(ctx, o) {        // lenço gaúcho: nó na frente, pontas caindo
    const g = grp('bandana'), c = ctx.mat('bandana', o.color ?? '#c8322b', .6), y = 0.86, r = ctx.bodyRadiusAt(y);
    const ring = mesh('ring', new THREE.TorusGeometry(r + 0.01, 0.035, 12, 48), c, g); ring.rotation.x = Math.PI / 2; ring.position.y = y;
    const knot = mesh('knot', new THREE.SphereGeometry(0.045, 16, 12), c, g); knot.position.set(0.02, y - 0.02, r + 0.035);
    for (const s of [-1, 1]) { const tail = mesh('tail', new THREE.ConeGeometry(0.045, 0.16, 4), c, g); tail.position.set(0.02 + s * 0.045, y - 0.12, r + 0.02); tail.rotation.set(0.15, 0.6, s * 0.4 + Math.PI); }
    return g;
  },
  canga(ctx, o) {          // canga por cima de um ombro: costas, ombro, frente
    const g = grp('canga'), c = ctx.mat('canga', o.color ?? '#1fa1d2', .7, DS), s = o.side === 'L' ? -1 : 1;
    const arc = mesh('wrap', new THREE.TorusGeometry(0.47, 0.04, 10, 40, Math.PI * 1.02), c, g);
    arc.position.set(s * 0.30, 0.56, 0); arc.rotation.y = Math.PI / 2; arc.rotation.z = -0.02; arc.scale.z = 2.2;
    return g;
  },
  necklace(ctx, o) {
    const g = grp('necklace'), c = ctx.mat('beads', o.color ?? '#e0b64a', .4, { metalness: .3 }), y = 0.86, r = ctx.bodyRadiusAt(y);
    const ring = mesh('chain', new THREE.TorusGeometry(r + 0.006, 0.01, 8, 48), c, g); ring.rotation.x = Math.PI / 2 + 0.12; ring.position.y = y;
    return g;
  },
};

// ---------------------------------------------------------------- roupas de cima (sem calça: suéteres, camisas, ponchos)
function sleeves(ctx: PartCtx, mat: THREE.Material, len: number, cuffMat: THREE.Material | null, r = 0.088) {
  const out: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = grp('sleeve' + (s < 0 ? 'L' : 'R'));
    const cap = mesh('shoulderCap', new THREE.SphereGeometry(r + 0.01, 24, 16), mat, g); cap.position.y = 0.0;
    const tube = mesh('sleeveTube', new THREE.CylinderGeometry(r, r * 0.95, len, 24), mat, g); tube.position.y = -len / 2;
    if (cuffMat) { const cuff = mesh('cuff', new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.035, 24), cuffMat, g); cuff.position.y = -len - 0.005; }
    out.push(g);
  }
  void ctx;
  return out;
}
export const TOPS: Record<string, TopBuilder> = {
  cardigan(ctx, o) {       // tricô aberto na frente, botões, manga longa
    const c = ctx.mat('knit', o.color ?? '#6b4a2b', .95), trim = ctx.mat('knitTrim', o.accent ?? '#d9c7a3', .95);
    const body = grp('top_cardigan'); const sh = shell(ctx, 0.26, 0.90, 0.035, 0.9, c); sh.name = 'cardiganShell'; body.add(sh);
    const collar = mesh('collar', new THREE.TorusGeometry(ctx.bodyRadiusAt(0.90) + 0.02, 0.03, 10, 48, Math.PI * 1.7), trim, body); collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI * 0.65; collar.position.y = 0.90;
    const hem = mesh('hem', new THREE.TorusGeometry(ctx.bodyRadiusAt(0.27) + 0.02, 0.022, 10, 48), trim, body); hem.rotation.x = Math.PI / 2; hem.position.y = 0.27;
    for (let i = 0; i < 3; i++) { const y = 0.50 + i * 0.13, r = ctx.bodyRadiusAt(y) + 0.04; const b = mesh('button' + i, new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), trim, body); b.rotation.x = Math.PI / 2; b.rotation.z = 0.46; b.position.set(Math.sin(0.46) * r, y, Math.cos(0.46) * r); }
    return { body, sleeves: sleeves(ctx, c, 0.30, trim) };
  },
  sweater(ctx, o) {        // tricô fechado com gola canelada
    const c = ctx.mat('knit', o.color ?? '#3a5a8a', .95), trim = ctx.mat('knitTrim', o.accent ?? '#e8e2d2', .95);
    const body = grp('top_sweater'); const sh = shell(ctx, 0.26, 0.90, 0.035, 0, c); sh.name = 'sweaterShell'; body.add(sh);
    const collar = mesh('collar', new THREE.TorusGeometry(ctx.bodyRadiusAt(0.90) + 0.02, 0.035, 10, 48), trim, body); collar.rotation.x = Math.PI / 2; collar.position.y = 0.905;
    const hem = mesh('hem', new THREE.TorusGeometry(ctx.bodyRadiusAt(0.27) + 0.02, 0.022, 10, 48), trim, body); hem.rotation.x = Math.PI / 2; hem.position.y = 0.27;
    return { body, sleeves: sleeves(ctx, c, 0.30, trim) };
  },
  jacket(ctx, o) {         // jaqueta de zíper com gola alta
    const c = ctx.mat('jacket', o.color ?? '#8b3a2f', .7), trim = ctx.mat('jacketTrim', o.accent ?? '#f1e3c8', .7), zip = ctx.mat('zipper', '#c9c9c9', .3, { metalness: .3 });
    const body = grp('top_jacket'); const sh = shell(ctx, 0.26, 0.92, 0.035, 0, c); sh.name = 'jacketShell'; body.add(sh);
    const collar = mesh('collar', new THREE.CylinderGeometry(ctx.bodyRadiusAt(0.95) + 0.05, ctx.bodyRadiusAt(0.92) + 0.04, 0.07, 48, 1, true), ctx.mat('jacketTrim', o.accent ?? '#f1e3c8', .7, DS), body); collar.position.y = 0.945;
    const pts: THREE.Vector3[] = []; for (let i = 0; i <= 10; i++) { const y = 0.28 + (0.90 - 0.28) * i / 10; pts.push(new THREE.Vector3(0, y, ctx.bodyRadiusAt(y) + 0.04)); }
    mesh('zipper', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.009, 8), zip, body);
    for (const s of [-1, 1]) { const pk = mesh('pocket', new THREE.BoxGeometry(0.11, 0.012, 0.02), trim, body); const y = 0.42, r = ctx.bodyRadiusAt(y) + 0.04, a = s * 0.55; pk.position.set(Math.sin(a) * r, y, Math.cos(a) * r); pk.rotation.y = a; }
    return { body, sleeves: sleeves(ctx, c, 0.30, trim) };
  },
  openShirt(ctx, o) {      // camisa tropical de manga curta, aberta
    const c = ctx.mat('shirt', o.color ?? '#f2c53d', .75), trim = ctx.mat('shirtTrim', o.accent ?? '#1f8a4c', .75);
    const body = grp('top_openShirt'); const sh = shell(ctx, 0.30, 0.90, 0.025, 1.1, c); sh.name = 'shirtShell'; body.add(sh);
    for (const s of [-1, 1]) { const lapel = mesh('lapel', new THREE.BoxGeometry(0.07, 0.15, 0.012), trim, body); const a = s * 0.55, r = ctx.bodyRadiusAt(0.82) + 0.03; lapel.position.set(Math.sin(a) * r, 0.82, Math.cos(a) * r); lapel.rotation.set(0, a, s * 0.55); }
    // estampas de folha: elipsoides achatados espalhados pela casca
    for (let i = 0; i < 8; i++) { const a = (i % 2 ? 1 : -1) * (0.9 + (i % 4) * 0.45), y = 0.36 + (i * 0.07) % 0.5, r = ctx.bodyRadiusAt(y) + 0.037; const leaf = mesh('print' + i, new THREE.SphereGeometry(0.035, 12, 8), trim, body); leaf.scale.set(1, 1.8, 0.25); leaf.position.set(Math.sin(a) * r, y, Math.cos(a) * r); leaf.rotation.set(0, a, 0.5 * (i % 3 - 1)); }
    return { body, sleeves: sleeves(ctx, c, 0.14, null, 0.095) };
  },
  vest(ctx, o) {           // colete de frevo, vivo, com debrum contrastante
    const c = ctx.mat('vest', o.color ?? '#e63946', .7), trim = ctx.mat('vestTrim', o.accent ?? '#ffb703', .6);
    const body = grp('top_vest'); const sh = shell(ctx, 0.30, 0.90, 0.03, 1.0, c); sh.name = 'vestShell'; body.add(sh);
    const collar = mesh('piping', new THREE.TorusGeometry(ctx.bodyRadiusAt(0.90) + 0.02, 0.02, 10, 48, Math.PI * 1.7), trim, body); collar.rotation.x = Math.PI / 2; collar.rotation.z = Math.PI * 0.65; collar.position.y = 0.90;
    const hem = mesh('hemPiping', new THREE.TorusGeometry(ctx.bodyRadiusAt(0.31) + 0.02, 0.02, 10, 48, Math.PI * 1.7), trim, body); hem.rotation.x = Math.PI / 2; hem.rotation.z = Math.PI * 0.65; hem.position.y = 0.31;
    const c2 = ctx.mat('vestStripe', o.accent2 ?? '#2a9d8f', .7);
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const y = 0.44 + i * 0.2, a = s * 1.9, r = ctx.bodyRadiusAt(y) + 0.035; const st = mesh('stripe', new THREE.BoxGeometry(0.16, 0.05, 0.015), i ? c2 : trim, body); st.position.set(Math.sin(a) * r, y, Math.cos(a) * r); st.rotation.y = a; }
    return { body, sleeves: null };
  },
  poncho(ctx, o) {         // pala gaúcho: painéis na frente e atrás, braços livres, franja
    const c = ctx.mat('wool', o.color ?? '#7a2e2e', .95, DS), trim = ctx.mat('woolStripe', o.accent ?? '#e8d8b0', .95, DS);
    const body = grp('top_poncho');
    const prof = [V2(0.24, 1.0), V2(0.46, 0.78), V2(0.62, 0.50), V2(0.60, 0.50), V2(0.44, 0.78), V2(0.23, 1.0)];
    for (const [name, start] of [['front', -Math.PI * 0.38], ['back', Math.PI - Math.PI * 0.38]] as const) {
      mesh('poncho' + name, new THREE.LatheGeometry(prof, 32, start, Math.PI * 0.76), c, body);
      mesh('ponchoStripe', new THREE.LatheGeometry([V2(0.535, 0.65), V2(0.575, 0.58), V2(0.565, 0.58), V2(0.525, 0.65)], 32, start, Math.PI * 0.76), trim, body);
      for (let i = 0; i <= 10; i++) { const a = start + Math.PI * 0.76 * i / 10; const f = mesh('fringe', new THREE.CylinderGeometry(0.008, 0.004, 0.08, 6), trim, body); f.position.set(Math.sin(a) * 0.615, 0.46, Math.cos(a) * 0.615); }
    }
    const neck = mesh('ponchoNeck', new THREE.TorusGeometry(0.25, 0.025, 10, 40), trim, body); neck.rotation.x = Math.PI / 2; neck.position.y = 1.0;
    return { body, sleeves: null };
  },
};

// ---------------------------------------------------------------- calçados (um por pé)
function soleGeo(depth = 0.035) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.085, -0.10); sh.quadraticCurveTo(-0.11, 0.00, -0.09, 0.09); sh.quadraticCurveTo(-0.06, 0.19, 0.00, 0.20); sh.quadraticCurveTo(0.06, 0.19, 0.09, 0.09);
  sh.quadraticCurveTo(0.11, 0.00, 0.085, -0.10); sh.quadraticCurveTo(0.00, -0.14, -0.085, -0.10);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 12 });
  g.rotateX(-Math.PI / 2); return g;
}
export const FOOTWEAR: Record<string, ShoeBuilder> = {
  sneaker(ctx, o) {
    const g = grp('sneaker'), sole = ctx.mat('sole', '#f4f0e8', .8), shoe = ctx.mat('shoe', o.color ?? '#2f4f8f', .7), lace = ctx.mat('lace', '#ffffff', .6);
    mesh('sole', soleGeo(), sole, g);
    const upper = mesh('upper', new THREE.SphereGeometry(0.09, 28, 18), shoe, g); upper.scale.set(0.95, 0.8, 1.5); upper.position.set(0, 0.06, 0.02);
    const toe = mesh('toeCap', new THREE.SphereGeometry(0.075, 24, 16), sole, g); toe.scale.set(1.05, 0.55, 1.1); toe.position.set(0, 0.048, 0.10);
    const cuff = mesh('cuff', new THREE.CylinderGeometry(0.095, 0.10, 0.06, 24), shoe, g); cuff.position.set(0, 0.12, -0.03);
    for (let i = 0; i < 3; i++) { const l = mesh('lace' + i, new THREE.BoxGeometry(0.075, 0.008, 0.012), lace, g); l.position.set(0, 0.12 - i * 0.028, 0.055 + i * 0.024); l.rotation.x = -0.75; }
    return g;
  },
  flipflop(ctx, o) {       // chinelo: sola fina, tira em Y, pé descalço na cor da pele
    const g = grp('flipflop'), sole = ctx.mat('flipflopSole', o.color ?? '#1f6fd1', .8), strap = ctx.mat('flipflopStrap', o.accent ?? '#f4f0e8', .7);
    mesh('sole', soleGeo(0.022), sole, g);
    const foot = mesh('foot', new THREE.SphereGeometry(0.085, 24, 16), ctx.skinMat, g); foot.scale.set(0.95, 0.55, 1.45); foot.position.set(0, 0.06, 0.03);
    for (let i = 0; i < 3; i++) { const t = mesh('toe' + i, new THREE.SphereGeometry(0.028, 12, 8), ctx.skinMat, g); t.position.set((i - 1) * 0.05, 0.045, 0.17); }
    const st = mesh('strap', new THREE.TorusGeometry(0.07, 0.012, 8, 24, Math.PI), strap, g); st.position.set(0, 0.035, 0.05); st.rotation.set(0.35, 0, 0); st.scale.set(1.25, 0.9, 1);
    return g;
  },
  boot(ctx, o) {           // bota campeira
    const g = grp('boot'), hide = ctx.mat('bootLeather', o.color ?? '#3a2a1e', .7), sole = ctx.mat('bootSole', '#1e1a17', .8);
    mesh('sole', soleGeo(0.03), sole, g);
    const foot = mesh('vamp', new THREE.SphereGeometry(0.09, 28, 18), hide, g); foot.scale.set(0.95, 0.75, 1.5); foot.position.set(0, 0.06, 0.02);
    const shaft = mesh('shaft', new THREE.CylinderGeometry(0.10, 0.095, 0.22, 24), hide, g); shaft.position.set(0, 0.17, -0.03);
    const heel = mesh('heel', new THREE.BoxGeometry(0.12, 0.03, 0.07), sole, g); heel.position.set(0, 0.015, -0.08);
    return g;
  },
};

// ---------------------------------------------------------------- o que segura na mão (origem = pegada; +y para cima)
export const PROPS: Record<string, PropBuilder> = {
  coffeeMug(ctx, o) {
    const g = grp('prop_mug'), c = ctx.mat('ceramic', o.color ?? '#f4f0e8', .5), cof = ctx.mat('coffee', '#3a2214', .4);
    const cup = mesh('cup', new THREE.CylinderGeometry(0.05, 0.045, 0.10, 24), c, g); cup.position.y = 0.05;
    const top = mesh('coffee', new THREE.CylinderGeometry(0.043, 0.043, 0.006, 24), cof, g); top.position.y = 0.10;
    const h = mesh('handle', new THREE.TorusGeometry(0.03, 0.008, 8, 20, Math.PI), c, g); h.position.set(0.05, 0.05, 0); h.rotation.z = -Math.PI / 2;
    return { obj: g, upright: true };
  },
  paoDeQueijo(ctx) {
    const g = grp('prop_paoDeQueijo'), c = ctx.mat('bread', '#e5b96a', .9);
    const b = mesh('pao', new THREE.SphereGeometry(0.055, 20, 14), c, g); b.scale.set(1, 0.85, 1); b.position.y = 0.04;
    const b2 = mesh('pao2', new THREE.SphereGeometry(0.042, 20, 14), c, g); b2.position.set(0.05, 0.03, 0.03);
    return { obj: g, upright: true };
  },
  chimarrao(ctx, o) {      // cuia de porongo com bomba
    const g = grp('prop_chimarrao'), gourd = ctx.mat('gourd', o.color ?? '#7a4a22', .75), metal = ctx.mat('silver', '#cfd3d8', .3, { metalness: .35 }), erva = ctx.mat('erva', '#5b7a2a', .9);
    const cuia = mesh('cuia', new THREE.SphereGeometry(0.062, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), ctx.mat('gourd', o.color ?? '#7a4a22', .75, DS), g); cuia.rotation.x = Math.PI; cuia.position.y = 0.085;
    const rim = mesh('rim', new THREE.TorusGeometry(0.056, 0.007, 8, 24), metal, g); rim.rotation.x = Math.PI / 2; rim.position.y = 0.11;
    const fill = mesh('erva', new THREE.CylinderGeometry(0.052, 0.052, 0.01, 24), erva, g); fill.position.y = 0.105;
    const foot = mesh('foot', new THREE.CylinderGeometry(0.03, 0.04, 0.03, 16), gourd, g); foot.position.y = 0.015;
    const bomba = mesh('bomba', new THREE.CylinderGeometry(0.005, 0.005, 0.20, 8), metal, g); bomba.position.set(0.02, 0.19, 0); bomba.rotation.z = -0.25;
    return { obj: g, upright: true };
  },
  terere(ctx, o) {         // guampa com bomba, gelado
    const g = grp('prop_terere'), horn = ctx.mat('horn', o.color ?? '#2b2622', .5), metal = ctx.mat('silver', '#cfd3d8', .3, { metalness: .35 }), erva = ctx.mat('erva', '#5b7a2a', .9);
    const cup = mesh('guampa', new THREE.CylinderGeometry(0.045, 0.03, 0.15, 20), horn, g); cup.position.y = 0.075;
    const ring = mesh('ring', new THREE.CylinderGeometry(0.047, 0.047, 0.02, 20), metal, g); ring.position.y = 0.14;
    const fill = mesh('erva', new THREE.CylinderGeometry(0.04, 0.04, 0.006, 20), erva, g); fill.position.y = 0.15;
    const bomba = mesh('bomba', new THREE.CylinderGeometry(0.005, 0.005, 0.20, 8), metal, g); bomba.position.set(0.015, 0.23, 0); bomba.rotation.z = -0.2;
    return { obj: g, upright: true };
  },
  sombrinha(ctx, o) {      // sombrinha de frevo: pequena e muito colorida
    const g = grp('prop_sombrinha'), stick = ctx.mat('stick', '#3a2a1e', .6);
    const cols = o.colors ?? ['#e63946', '#ffb703', '#2a9d8f', '#8338ec', '#fb5607', '#06d6a0'];
    const h = mesh('handle', new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8), stick, g); h.position.y = 0.16;
    const n = cols.length;
    for (let i = 0; i < n; i++) { const seg = mesh('panel' + i, new THREE.ConeGeometry(0.22, 0.11, 24, 1, true, i * Math.PI * 2 / n, Math.PI * 2 / n), ctx.mat('panel' + i, cols[i], .6, DS), g); seg.position.y = 0.36; }
    const tip = mesh('tip', new THREE.ConeGeometry(0.012, 0.05, 8), stick, g); tip.position.y = 0.43;
    const trim = mesh('fringe', new THREE.TorusGeometry(0.22, 0.008, 6, 40), ctx.mat('fringeGold', '#ffd166', .5), g); trim.rotation.x = Math.PI / 2; trim.position.y = 0.305;
    return { obj: g, upright: false };
  },
  coconut(ctx, o) {        // água de coco com canudo
    const g = grp('prop_coconut'), green = ctx.mat('coconut', '#5fa851', .6), white = ctx.mat('coconutFlesh', '#f7f3e8', .5), straw = ctx.mat('straw', o.accent ?? '#e63946', .4);
    const nut = mesh('coconut', new THREE.SphereGeometry(0.075, 24, 16), green, g); nut.scale.set(1, 1.15, 1); nut.position.y = 0.085;
    const cut = mesh('cut', new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16), white, g); cut.position.y = 0.168;
    const st = mesh('straw', new THREE.CylinderGeometry(0.006, 0.006, 0.16, 8), straw, g); st.position.set(0.015, 0.23, 0); st.rotation.z = -0.15;
    return { obj: g, upright: true };
  },
  football(ctx) {
    const g = grp('prop_football'), w = ctx.mat('ballWhite', '#f4f4f4', .5), k = ctx.mat('ballBlack', '#1e1e1e', .5);
    mesh('ball', new THREE.SphereGeometry(0.085, 28, 20), w, g).position.y = 0.085;
    const dirs: [number, number, number][] = [[0, 1, 0], [0.9, 0.3, 0.3], [-0.9, 0.3, 0.3], [0, 0.3, -0.95], [0.5, -0.6, 0.6], [-0.5, -0.6, 0.6], [0, -0.6, -0.8]];
    dirs.forEach((d, i) => { const v = new THREE.Vector3(...d).normalize(); const p = mesh('patch' + i, new THREE.CylinderGeometry(0.028, 0.028, 0.006, 5), k, g); p.position.copy(v).multiplyScalar(0.083); p.position.y += 0.085; p.lookAt(p.position.clone().add(v)); p.rotateX(Math.PI / 2); });
    return { obj: g, upright: true };
  },
  guarana(ctx, o) {        // latinha
    const g = grp('prop_guarana'), can = ctx.mat('can', o.color ?? '#1f8a4c', .35, { metalness: .3 }), top = ctx.mat('canTop', '#d0d4d8', .3, { metalness: .35 });
    mesh('can', new THREE.CylinderGeometry(0.036, 0.036, 0.13, 24), can, g).position.y = 0.065;
    mesh('canTop', new THREE.CylinderGeometry(0.03, 0.036, 0.012, 24), top, g).position.y = 0.136;
    const label = mesh('label', new THREE.CylinderGeometry(0.037, 0.037, 0.05, 24), ctx.mat('canLabel', o.accent ?? '#f4d35e', .4), g); label.position.y = 0.07;
    return { obj: g, upright: true };
  },
  tacaca(ctx) {            // cuia de tacacá (tucupi amarelo)
    const g = grp('prop_tacaca'), soup = ctx.mat('tucupi', '#e8b420', .3);
    const bowl = mesh('cuia', new THREE.SphereGeometry(0.07, 24, 16, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), ctx.mat('gourdBlack', '#1e1a17', .6, DS), g); bowl.position.y = 0.07;
    const fill = mesh('tucupi', new THREE.CylinderGeometry(0.066, 0.066, 0.008, 24), soup, g); fill.position.y = 0.075;
    return { obj: g, upright: true };
  },
};

// ---------------------------------------------------------------- bichos no ombro
export const PETS: Record<string, PartBuilder> = {
  arara(ctx) {             // arara-vermelha pousada no ombro
    const g = grp('pet_arara'), red = ctx.mat('araraRed', '#d62828', .6), blue = ctx.mat('araraBlue', '#1d4ed8', .6), yellow = ctx.mat('araraYellow', '#f4d35e', .6), beak = ctx.mat('beak', '#1e1a17', .5), white = ctx.mat('araraFace', '#f4f0e8', .5);
    const body = mesh('body', new THREE.CapsuleGeometry(0.045, 0.08, 6, 16), red, g); body.rotation.x = 0.55; body.position.set(0, 0.10, -0.01);
    const head = mesh('head', new THREE.SphereGeometry(0.038, 18, 12), red, g); head.position.set(0, 0.19, 0.04);
    const face = mesh('face', new THREE.SphereGeometry(0.02, 12, 8), white, g); face.position.set(0, 0.19, 0.07);
    const bk = mesh('beak', new THREE.ConeGeometry(0.014, 0.04, 10), beak, g); bk.rotation.x = Math.PI / 2 + 0.3; bk.position.set(0, 0.18, 0.095);
    for (const s of [-1, 1]) { const eye = mesh('eye', new THREE.SphereGeometry(0.006, 8, 6), beak, g); eye.position.set(s * 0.02, 0.20, 0.07); const wing = mesh('wing', new THREE.SphereGeometry(0.04, 14, 10), blue, g); wing.scale.set(0.35, 1.3, 0.8); wing.position.set(s * 0.04, 0.10, -0.02); wing.rotation.x = 0.4; const wy = mesh('wingYellow', new THREE.SphereGeometry(0.025, 12, 8), yellow, g); wy.scale.set(0.3, 1, 0.7); wy.position.set(s * 0.045, 0.13, 0.0); }
    const tail = mesh('tail', new THREE.BoxGeometry(0.03, 0.16, 0.012), blue, g); tail.position.set(0, 0.0, -0.07); tail.rotation.x = 0.5;
    return g;
  },
};
