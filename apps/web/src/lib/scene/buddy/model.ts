/**
 * O boneco: um feijão torneado com braços e pernas de cápsula, o rosto desenhado no corpo e um molho pendurado
 * em vagas. Tudo procedural (ADR 0006): expressões são sete números interpolados por quadro, a boca é uma forma
 * refeita quando muda, andar/pular/sentar/quicar são curvas à mão sobre meia dúzia de ângulos, e o olhar vai
 * primeiro nos olhos e depois no tronco. Origem nos pés, y para cima, frente em +z, ~1.65 m de pé.
 */
import * as THREE from 'three';
import { EYEWEAR, FACIAL_HAIR, FOOTWEAR, HAIR, HATS, NECK, PETS, PROPS, TOPS, type PartCtx, type PartOptions } from './parts';

export type ExpressionName = 'Neutral' | 'Happy' | 'Laughing' | 'Sad' | 'Angry' | 'Surprised' | 'Smug' | 'Calm' | 'Proud' | 'Cheeky';
export type ArmPoseName = 'Relaxed' | 'HoldCards' | 'Cheer' | 'Shrug' | 'Casual' | 'Raise' | 'OnTable';
/** Idle e Walk são laços; Jump e Bounce tocam uma vez e voltam ao laço anterior. Sentar é um estado à parte (`setSeated`). */
export type AnimationName = 'Idle' | 'Walk' | 'Jump' | 'Bounce';

/** Rosto. curve: -1 bico … +1 sorriso; open: 0 fechada … 1 escancarada; width em metros. */
export interface FacePose { curve: number; open: number; width: number; browTilt: number; browUp: number; eyeV: number; pupilD: number }
/** Ombro e cotovelo em radianos (espelhados por lado). */
export interface ArmPose { shX: number; shY: number; shZ: number; elX: number }

export type HatKind = 'gaucho' | 'cowboy' | 'straw' | 'leather' | 'cap' | 'headband';
export type HairKind = 'flat' | 'curly' | 'spiky' | 'buzz' | 'long' | 'bun';
export type FacialHairKind = 'mustache' | 'thickMustache' | 'goatee' | 'beard';
export type EyewearKind = 'sunglasses' | 'roundGlasses';
export type NeckKind = 'bandana' | 'canga' | 'necklace';
export type TopKind = 'cardigan' | 'sweater' | 'jacket' | 'openShirt' | 'vest' | 'poncho';
export type FootwearKind = 'sneaker' | 'flipflop' | 'boot';
export type PropKind = 'coffeeMug' | 'paoDeQueijo' | 'chimarrao' | 'terere' | 'sombrinha' | 'coconut' | 'football' | 'guarana' | 'tacaca';
export type PetKind = 'arara';

/** Uma peça: só a chave, ou a chave com cores. */
export type PartSpec<K extends string> = K | 'none' | ({ kind: K } & Omit<PartOptions, 'kind'>);

/** O molho: cada campo é uma vaga do boneco. */
export interface Outfit {
  skin?: string; belly?: string;
  hat?: PartSpec<HatKind>;
  hair?: PartSpec<HairKind>;
  facialHair?: PartSpec<FacialHairKind>;
  eyewear?: PartSpec<EyewearKind>;
  neck?: PartSpec<NeckKind>;
  top?: PartSpec<TopKind>;
  footwear?: PartSpec<FootwearKind>;
  propL?: PartSpec<PropKind>;
  propR?: PartSpec<PropKind>;
  pet?: PartSpec<PetKind>;
  expression?: ExpressionName;
  arms?: ArmPoseName;
}

export interface BuddyOptions {
  outfit?: Outfit;
  /** vulto: um material translúcido só, para toda peça; o molho sobrevive como silhueta */
  ghost?: boolean;
  blinking?: boolean;
}

export const EXPRESSIONS: Record<ExpressionName, FacePose> = {
  Neutral:   { curve: .15, open: .06, width: .24, browTilt: 0,    browUp: 0,     eyeV: 1,    pupilD: 0 },
  Happy:     { curve: .85, open: .15, width: .28, browTilt: -.15, browUp: .02,   eyeV: 1,    pupilD: 0 },
  Laughing:  { curve: .7,  open: .85, width: .32, browTilt: -.2,  browUp: .03,   eyeV: .25,  pupilD: 0 },
  Sad:       { curve: -.7, open: .05, width: .19, browTilt: -.55, browUp: .03,   eyeV: .85,  pupilD: -.01 },
  Angry:     { curve: -.5, open: .12, width: .24, browTilt: .7,   browUp: -.045, eyeV: .7,   pupilD: 0 },
  Surprised: { curve: .05, open: .75, width: .17, browTilt: 0,    browUp: .05,   eyeV: 1.25, pupilD: 0 },
  Smug:      { curve: .6,  open: .02, width: .22, browTilt: .25,  browUp: -.01,  eyeV: .6,   pupilD: .01 },
  Calm:      { curve: .35, open: .02, width: .20, browTilt: -.05, browUp: -.01,  eyeV: .55,  pupilD: -.005 },
  Proud:     { curve: .25, open: .02, width: .22, browTilt: .35,  browUp: -.02,  eyeV: .8,   pupilD: .005 },
  Cheeky:    { curve: .9,  open: .3,  width: .28, browTilt: -.3,  browUp: .04,   eyeV: .9,   pupilD: .01 },
};

// ombro: x = balanço para a frente (negativo = frente), z = abrir para fora; cotovelo: x = dobra (negativo = antebraço para a frente/cima)
export const ARM_POSES: Record<ArmPoseName, ArmPose> = {
  Relaxed:   { shX: -.08, shZ: .14, shY: 0,   elX: -.35 },
  HoldCards: { shX: -.55, shZ: .20, shY: .35, elX: -1.35 },
  Cheer:     { shX: -.2,  shZ: 2.7, shY: 0,   elX: -.4 },
  Shrug:     { shX: -.3,  shZ: .9,  shY: .2,  elX: -1.9 },
  Casual:    { shX: -.25, shZ: .22, shY: .15, elX: -1.05 },
  Raise:     { shX: -.4,  shZ: .35, shY: .1,  elX: -1.9 },
  /** antebraços apoiados no tampo da mesa (sentado à mesa do truco); os números vêm do teste de pose */
  OnTable:   { shX: -.55, shZ: .05, shY: .2, elX: -.6 },
};

export const H = 1.45, R = 0.46, BODY_Y = 0.20, HIP_Y = 0.34;
const EYE_Y = 1.20, MOUTH_Y = 0.98, BROW_DY = 0.13;
/** Altura dos olhos, em pé ou sentado (sentar dobra as pernas para a frente; o corpo não desce). */
export const BUDDY_EYE = EYE_Y + BODY_Y;
/** Quanto os olhos ficam à frente do centro do corpo: a câmera em primeira pessoa fica aqui. */
export const BUDDY_EYE_FORWARD = 0.29;
export const BUDDY_HEIGHT = H + BODY_Y;
/** Assento que o boneco usa: o corpo apoia nele, as pernas saem por cima da borda. */
export const STOOL_H = BODY_Y;

/** Até onde só os olhos viram; depois o tronco acompanha, até o seu limite. */
const EYE_YAW = 0.35, TORSO_YAW = 0.6, EYE_PITCH = 0.3, TORSO_PITCH = 0.25;
const JUMP_DUR = 1.1, BOUNCE_DUR = 0.55;

const GHOST_COLOR = '#cfe3ff', GHOST_INK = '#1a2230';

export interface Buddy {
  group: THREE.Group;
  materials: Record<string, THREE.MeshStandardMaterial>;
  handSockets: [THREE.Group, THREE.Group];
  /** Chama a cada quadro com o delta em segundos. */
  update(dt: number): void;
  setExpression(name: ExpressionName, instant?: boolean): void;
  setArms(pose: ArmPoseName | Partial<ArmPose>, instant?: boolean): void;
  setAnimation(name: AnimationName): void;
  getAnimation(): AnimationName;
  jump(): void;
  bounce(): void;
  /** sentado: pernas para a frente, sobre um assento de `STOOL_H`; o laço vira respiração sentada */
  setSeated(v: boolean): void;
  isSeated(): boolean;
  setWalkSpeed(v: number): void;
  /** olhar relativo ao boneco, em radianos: yaw positivo vira para +x, pitch positivo olha para cima */
  setLook(yaw: number, pitch: number): void;
  /** 0..1: quanto se inclina para a frente (a pessoa deu zoom) */
  setLean(v: number): void;
  setTalking(v: boolean): void;
  setBlinking(v: boolean): void;
  /** escurece o boneco (cadeira assumida por um bot) */
  setDimmed(v: boolean): void;
  /** primeira pessoa: some o que ficaria na frente da câmera (rosto, chapéu, cabelo, roupa, pescoço); braços e corpo ficam */
  setFirstPerson(v: boolean): void;
  setOutfit(outfit: Outfit): void;
  getOutfit(): Outfit;
  dispose(): void;
}

type Lib<T> = Record<string, T>;
function pick<T>(lib: Lib<T>, spec: PartSpec<string> | undefined): [T, PartOptions] | null {
  if (!spec) return null;
  const key = typeof spec === 'string' ? spec : spec.kind;
  if (!key || key === 'none' || !lib[key]) return null;
  return [lib[key], typeof spec === 'string' ? {} : spec];
}

export function createBuddy(opts: BuddyOptions = {}): Buddy {
  const ghost = !!opts.ghost;
  const baseColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  const std = (name: string, color: string, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra }); m.name = name;
    baseColors.set(m, m.color.clone());
    return m;
  };
  const ghostMat = ghost ? std('ghost', GHOST_COLOR, .6, { transparent: true, opacity: 0.4, depthWrite: false }) : null;
  const ghostInk = ghost ? std('ghostInk', GHOST_INK, .6, { transparent: true, opacity: 0.85, depthWrite: false }) : null;
  const matCache = new Map<string, THREE.MeshStandardMaterial>();  // materiais do molho, por nome+cor+lado
  const mat: PartCtx['mat'] = (name, color, roughness = .7, extra = {}) => {
    if (ghostMat) return ghostMat;
    const k = `${name}:${color}:${extra.side ?? ''}`;
    let m = matCache.get(k);
    if (!m) { m = std(name, color, roughness, extra); matCache.set(k, m); }
    return m;
  };
  const mats = {
    body: ghostMat ?? std('skin', '#f2a141', .55),
    belly: ghostMat ?? std('belly', '#f6ead4', .6),
    white: ghostMat ?? std('eyeWhite', '#ffffff', .35),
    ink: ghostInk ?? std('ink', '#2b2622', .5),
    mouth: ghostInk ?? std('mouthInner', '#5e2430', .6, { side: THREE.DoubleSide }),
  };

  // ---- corpo ----
  const bodyRadiusAt = (y: number) => {
    const t = Math.min(Math.max(y / H, 0.001), 0.999);
    return R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.92)), 0.36) * (1 - 0.10 * t);
  };
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 48; i++) { const t = i / 48; profile.push(new THREE.Vector2(bodyRadiusAt(t * H), t * H)); }

  const group = new THREE.Group(); group.name = 'buddy';
  const mesh = (name: string, geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D) => { const o = new THREE.Mesh(geo, m); o.name = name; parent.add(o); return o; };

  // corpo e tronco vão no `rig`, que quica e inclina sem mexer na origem no chão
  const rig = new THREE.Group(); rig.name = 'rig'; group.add(rig);
  const body = mesh('body', new THREE.LatheGeometry(profile, 56), mats.body, rig);
  body.position.y = BODY_Y;
  const torso = new THREE.Group(); torso.name = 'torso'; torso.position.y = BODY_Y; rig.add(torso);

  const belly = mesh('bellyPatch', new THREE.SphereGeometry(0.30, 40, 28), mats.belly, torso);
  belly.scale.set(0.62, 1.05, 0.22);
  belly.position.set(0, 0.50, bodyRadiusAt(0.50) * 0.90);

  // ---- pernas (o calçado vem do molho) ----
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.22, 8, 20);
  const hips: THREE.Group[] = [], shoeSlots: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';
    const hip = new THREE.Group(); hip.name = 'hip' + L; hip.position.set(s * 0.17, HIP_Y, 0); rig.add(hip); hips.push(hip);
    const leg = mesh('leg' + L, legGeo, mats.body, hip); leg.position.y = -0.12;
    const shoe = new THREE.Group(); shoe.name = 'foot' + L; shoe.position.set(0, -HIP_Y, 0.03); shoe.rotation.y = s * 0.08; hip.add(shoe); shoeSlots.push(shoe);
  }

  // ---- braços: ombro → braço → cotovelo → antebraço → mão ----
  const shoulderY = 0.98, UP_LEN = 0.30, FORE_LEN = 0.28;
  const upperGeo = new THREE.CapsuleGeometry(0.065, UP_LEN, 8, 20), foreGeo = new THREE.CapsuleGeometry(0.06, FORE_LEN, 8, 20);
  const palmGeo = new THREE.SphereGeometry(0.07, 24, 16), fingerGeo = new THREE.CapsuleGeometry(0.024, 0.055, 6, 12), thumbGeo = new THREE.CapsuleGeometry(0.024, 0.04, 6, 12);
  const shoulders: THREE.Group[] = [], elbows: THREE.Group[] = [], handSockets: THREE.Group[] = [], sleeveSlots: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';
    const sh = new THREE.Group(); sh.name = 'shoulder' + L;
    sh.position.set(s * (bodyRadiusAt(shoulderY) - 0.03), shoulderY, 0.02); torso.add(sh);
    const upper = mesh('upperArm' + L, upperGeo, mats.body, sh); upper.position.y = -UP_LEN / 2;
    const sleeveSlot = new THREE.Group(); sleeveSlot.name = 'sleeveSlot' + L; sh.add(sleeveSlot); sleeveSlots.push(sleeveSlot);
    const el = new THREE.Group(); el.name = 'elbow' + L; el.position.y = -UP_LEN; sh.add(el);
    const fore = mesh('forearm' + L, foreGeo, mats.body, el); fore.position.y = -FORE_LEN / 2;
    const hand = new THREE.Group(); hand.name = 'hand' + L; hand.position.y = -FORE_LEN - 0.02; el.add(hand);
    const palm = mesh('palm' + L, palmGeo, mats.body, hand); palm.scale.set(1, 1.05, 0.62);
    for (let i = 0; i < 3; i++) {                              // dedos em leque para baixo
      const f = mesh('finger' + L + i, fingerGeo, mats.body, hand);
      const a = (i - 1) * 0.30;
      f.position.set(Math.sin(a) * 0.05, -0.065 - Math.cos(a) * 0.025, (i - 1) * 0.004);
      f.rotation.z = a;
    }
    const thumb = mesh('thumb' + L, thumbGeo, mats.body, hand);
    thumb.position.set(0, -0.02, 0.055); thumb.rotation.x = -0.9;   // polegar para a frente
    const socket = new THREE.Group(); socket.name = 'handSocket' + L; socket.position.set(0, -0.03, 0.05); hand.add(socket);
    shoulders.push(sh); elbows.push(el); handSockets.push(socket);
  }

  // ---- rosto ----
  const rEyes = bodyRadiusAt(EYE_Y), rBrows = bodyRadiusAt(EYE_Y + BROW_DY), rMouth = bodyRadiusAt(MOUTH_Y);
  const eyeGeo = new THREE.SphereGeometry(0.082, 28, 20), pupilGeo = new THREE.SphereGeometry(0.034, 20, 14), browGeo = new THREE.CapsuleGeometry(0.020, 0.10, 6, 14);
  const eyeGrps: THREE.Group[] = [], pupils: THREE.Mesh[] = [], brows: THREE.Group[] = [];
  const face = new THREE.Group(); face.name = 'face'; torso.add(face);
  for (const s of [-1, 1]) {
    const L = s < 0 ? 'L' : 'R';
    const eg = new THREE.Group(); eg.name = 'eye' + L; eg.position.set(s * 0.155, EYE_Y, rEyes * 0.90); eg.rotation.y = s * 0.28; face.add(eg);
    const eye = mesh('eyeWhite' + L, eyeGeo, mats.white, eg); eye.scale.set(1, 1.25, 0.55);
    const pupil = mesh('pupil' + L, pupilGeo, mats.ink, eg); pupil.position.z = 0.052; pupil.scale.z = 0.5;
    const bg = new THREE.Group(); bg.name = 'brow' + L; bg.position.set(s * 0.155, EYE_Y + BROW_DY, rBrows * 0.97); bg.rotation.y = s * 0.28; face.add(bg);
    const brow = mesh('browCapsule' + L, browGeo, mats.ink, bg); brow.rotation.z = Math.PI / 2;
    eyeGrps.push(eg); pupils.push(pupil); brows.push(bg);
  }
  const mouthMesh = mesh('mouth', new THREE.BufferGeometry(), mats.mouth, face);
  mouthMesh.position.y = MOUTH_Y;

  let mouthKey = '';
  function buildMouth(curve: number, open: number, width: number) {
    const key = `${curve.toFixed(3)}:${open.toFixed(3)}:${width.toFixed(3)}`;
    if (key === mouthKey) return;
    mouthKey = key;
    const w = width / 2, t = 0.020, n = 26, top: [number, number][] = [], bot: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = -w + 2 * w * i / n, u = x / w;
      const yc = curve * 0.055 * u * u - curve * 0.02;
      const gap = open * 0.10 * Math.pow(Math.max(1 - u * u, 0), 0.8) + t;
      top.push([x, yc + gap / 2]); bot.push([x, yc - gap / 2]);
    }
    const shape = new THREE.Shape(); shape.moveTo(top[0][0], top[0][1]);
    for (const p of top) shape.lineTo(p[0], p[1]);
    for (let i = n; i >= 0; i--) shape.lineTo(bot[i][0], bot[i][1]);
    const geo = new THREE.ShapeGeometry(shape, 8);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, Math.sqrt(Math.max(rMouth * rMouth - x * x, 0)) + 0.012); }
    geo.computeVertexNormals();
    mouthMesh.geometry.dispose(); mouthMesh.geometry = geo;
  }

  // ---- estado ----
  const FACE_KEYS = Object.keys(EXPRESSIONS.Neutral) as (keyof FacePose)[], ARM_KEYS = Object.keys(ARM_POSES.Relaxed) as (keyof ArmPose)[];
  let cur: FacePose = { ...EXPRESSIONS.Neutral }, target: FacePose = { ...EXPRESSIONS.Neutral };
  let armCur: ArmPose = { ...ARM_POSES.Relaxed }, armTarget: ArmPose = { ...ARM_POSES.Relaxed };
  let talking = false, blinking = opts.blinking ?? true, blinkT = 0, blinkNext = 2.2, t = 0;
  let anim: AnimationName = 'Idle', animAfter: AnimationName = 'Idle', animT = 0, oneShotT = -1, walkSpeed = 1, seated = false;
  const look = { yaw: 0, pitch: 0, lean: 0 }, lookCur = { yaw: 0, pitch: 0, lean: 0 };
  const loco = { bob: 0, lean: 0, hipL: 0, hipR: 0, armSwing: 0, armSpread: 0, squash: 1, footL: 0, footR: 0 };
  const locoT = { ...loco };
  type LocoKey = keyof typeof loco;

  function applyPose(p: FacePose, blink: number) {
    buildMouth(p.curve, p.open, p.width);
    // olhar: os olhos viram primeiro; o que passa do alcance deles vai para o tronco
    const eyeYaw = THREE.MathUtils.clamp(lookCur.yaw, -EYE_YAW, EYE_YAW), eyePitch = THREE.MathUtils.clamp(lookCur.pitch, -EYE_PITCH, EYE_PITCH);
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      brows[i].rotation.z = s * p.browTilt;
      brows[i].position.y = EYE_Y + BROW_DY + p.browUp;
      eyeGrps[i].scale.y = Math.max(p.eyeV * blink, 0.08);
      pupils[i].position.x = Math.sin(eyeYaw) * 0.045;
      pupils[i].position.y = p.pupilD + Math.sin(eyePitch) * 0.04;
    }
    const over = (v: number, lim: number) => Math.sign(v) * Math.max(0, Math.abs(v) - lim);
    torso.rotation.y = THREE.MathUtils.clamp(over(lookCur.yaw, EYE_YAW), -TORSO_YAW, TORSO_YAW);
    torso.rotation.x = -THREE.MathUtils.clamp(over(lookCur.pitch, EYE_PITCH), -TORSO_PITCH, TORSO_PITCH);
  }
  function applyArms(a: ArmPose) {
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const swing = (i === 0 ? 1 : -1) * loco.armSwing;
      shoulders[i].rotation.set(a.shX + swing, s * -a.shY, s * (a.shZ + loco.armSpread));
      elbows[i].rotation.x = a.elX;
    }
  }
  function applyLoco() {
    rig.position.y = loco.bob;
    rig.rotation.x = loco.lean + lookCur.lean * 0.35;
    rig.scale.set(1 / Math.sqrt(loco.squash), loco.squash, 1 / Math.sqrt(loco.squash));
    hips[0].rotation.x = loco.hipL; hips[1].rotation.x = loco.hipR;
    shoeSlots[0].rotation.x = -loco.hipL * 0.6 + loco.footL;
    shoeSlots[1].rotation.x = -loco.hipR * 0.6 + loco.footR;
  }
  function tickLoco(dt: number) {
    animT += dt;
    const T = locoT;
    if (anim === 'Walk') {
      const w = animT * 6.5 * walkSpeed, sw = Math.sin(w);
      T.hipL = sw * 0.55; T.hipR = -sw * 0.55;
      T.footL = Math.max(0, -Math.cos(w)) * 0.35; T.footR = Math.max(0, Math.cos(w)) * 0.35;
      T.bob = Math.abs(Math.cos(w)) * 0.035; T.lean = -0.06;
      T.armSwing = sw * 0.45; T.armSpread = 0.05; T.squash = 1 + Math.cos(w * 2) * 0.012;
    } else if (anim === 'Jump') {
      const u = Math.min(oneShotT / JUMP_DUR, 1);
      // agachar → saltar → pairar → aterrissar amassado → recuperar
      let bob = 0, sq = 1, hip = 0, spread = 0, lean = 0;
      if (u < 0.18)      { const a = u / 0.18;             sq = 1 - 0.14 * Math.sin(a * Math.PI / 2); hip = 0.35 * a; spread = -0.2 * a; lean = 0.08 * a; }
      else if (u < 0.75) { const a = (u - 0.18) / 0.57;    bob = Math.sin(a * Math.PI) * 0.55; sq = 1 + 0.08 * Math.sin(a * Math.PI); hip = -0.5 * Math.sin(a * Math.PI); spread = 1.6 * Math.sin(a * Math.PI); lean = -0.10 * Math.sin(a * Math.PI); }
      else if (u < 0.88) { const a = (u - 0.75) / 0.13;    sq = 1 - 0.16 * Math.sin(a * Math.PI); hip = 0.3 * Math.sin(a * Math.PI); spread = 0.3 * (1 - a); }
      else               { const a = (u - 0.88) / 0.12;    sq = 1 - 0.03 * (1 - a); }
      T.bob = bob; T.squash = sq; T.hipL = T.hipR = hip; T.footL = T.footR = hip < 0 ? -hip * 0.8 : 0;
      T.armSpread = spread; T.armSwing = 0; T.lean = lean;
      oneShotT += dt;
      if (oneShotT >= JUMP_DUR) { anim = animAfter; oneShotT = -1; animT = 0; }
    } else if (anim === 'Bounce') {
      // quicar no assento: amassa, sobe um palmo, cai amassado, volta
      const u = Math.min(oneShotT / BOUNCE_DUR, 1);
      let bob = 0, sq = 1, spread = 0;
      if (u < 0.25)      { const a = u / 0.25;             sq = 1 - 0.15 * Math.sin(a * Math.PI / 2); }
      else if (u < 0.75) { const a = (u - 0.25) / 0.5;     bob = Math.sin(a * Math.PI) * 0.12; sq = 1 + 0.08 * Math.sin(a * Math.PI); spread = 0.6 * Math.sin(a * Math.PI); }
      else               { const a = (u - 0.75) / 0.25;    sq = 1 - 0.10 * Math.sin(a * Math.PI); }
      T.bob = bob; T.squash = sq; T.armSpread = spread; T.armSwing = 0; T.lean = 0; T.hipL = T.hipR = 0; T.footL = T.footR = 0;
      oneShotT += dt;
      if (oneShotT >= BOUNCE_DUR) { anim = animAfter; oneShotT = -1; animT = 0; }
    } else { // Idle: respiração e um balanço de peso mínimo
      T.bob = Math.sin(animT * 1.6) * 0.008; T.squash = 1 + Math.sin(animT * 1.6) * 0.012;
      T.lean = Math.sin(animT * 0.7) * 0.015; T.hipL = T.hipR = 0; T.footL = T.footR = 0;
      T.armSwing = Math.sin(animT * 1.6 + 1) * 0.04; T.armSpread = Math.sin(animT * 1.6) * 0.02;
    }
    if (seated) { T.hipL = T.hipR = -1.35; T.footL = T.footR = 0.55; T.lean = anim === 'Idle' ? T.lean : 0; }
    const k = anim === 'Jump' || anim === 'Bounce' ? 1 : Math.min(dt * 14, 1);
    for (const key of Object.keys(loco) as LocoKey[]) loco[key] += (T[key] - loco[key]) * k;
  }
  const lerp = <T extends object>(o: T, tg: T, keys: (keyof T)[], k: number) => { for (const key of keys) (o[key] as number) += ((tg[key] as number) - (o[key] as number)) * k; };

  function update(dt: number) {
    dt = Math.min(dt, 0.05); t += dt;
    const k = Math.min(dt * 10, 1);
    lerp(cur, target, FACE_KEYS, k); lerp(armCur, armTarget, ARM_KEYS, k * 0.7);
    lerp(lookCur, look, ['yaw', 'pitch', 'lean'], Math.min(dt * 8, 1));
    let open = cur.open;
    if (talking) open = Math.max(0.04, cur.open * 0.4 + 0.35 + 0.33 * Math.sin(t * 11) + 0.12 * Math.sin(t * 27));
    let blink = 1;
    if (blinking) {
      blinkT += dt;
      if (blinkT > blinkNext) {
        const ph = (blinkT - blinkNext) / 0.22;
        blink = ph < 1 ? 1 - Math.sin(ph * Math.PI) * 0.92 : 1;
        if (ph >= 1) { blinkT = 0; blinkNext = 1.6 + Math.random() * 2.6; }
      }
    }
    applyPose({ ...cur, open }, blink); tickLoco(dt); applyLoco(); applyArms(armCur);
    keepPropsUpright();
  }

  // ---- vagas do molho ----
  const slot = (name: string, parent: THREE.Object3D) => { const g = new THREE.Group(); g.name = name; parent.add(g); return g; };
  const slots = {
    hat: slot('hatSlot', torso), hair: slot('hairSlot', torso), face: slot('faceSlot', face), neck: slot('neckSlot', torso),
    top: slot('topSlot', torso), pet: slot('petSlot', torso),
  };
  const ctx: PartCtx = { mat, bodyRadiusAt, H, eyeY: EYE_Y, mouthY: MOUTH_Y, rEyes, skinMat: mats.body };
  const clear = (g: THREE.Object3D) => { for (const c of [...g.children]) { g.remove(c); c.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); } };
  const uprightProps: THREE.Object3D[] = [];
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  function keepPropsUpright() {
    for (const p of uprightProps) { p.parent!.getWorldQuaternion(_q); group.getWorldQuaternion(_q2); p.quaternion.copy(_q.invert().multiply(_q2)); }
  }
  let outfit: Outfit = {};
  const setExpression = (name: ExpressionName, instant?: boolean) => { if (!EXPRESSIONS[name]) return; target = { ...EXPRESSIONS[name] }; if (instant) { cur = { ...target }; applyPose(cur, 1); } };
  const setArms = (pose: ArmPoseName | Partial<ArmPose>, instant?: boolean) => {
    const p = typeof pose === 'string' ? ARM_POSES[pose] : pose; if (!p) return;
    armTarget = { ...armTarget, ...p }; if (instant) { armCur = { ...armTarget }; applyArms(armCur); }
  };
  function setOutfit(o: Outfit) {
    outfit = { ...o };
    for (const g of [...Object.values(slots), ...sleeveSlots, ...shoeSlots, ...handSockets]) clear(g);
    uprightProps.length = 0;
    if (!ghost) {
      if (o.skin) mats.body.color.set(o.skin);
      if (o.belly) mats.belly.color.set(o.belly);
      baseColors.set(mats.body, mats.body.color.clone()); baseColors.set(mats.belly, mats.belly.color.clone());
    }
    let r;
    if ((r = pick(HATS, o.hat))) slots.hat.add(r[0](ctx, r[1]));
    if ((r = pick(HAIR, o.hair))) slots.hair.add(r[0](ctx, r[1]));
    if ((r = pick(FACIAL_HAIR, o.facialHair))) slots.face.add(r[0](ctx, r[1]));
    if ((r = pick(EYEWEAR, o.eyewear))) slots.face.add(r[0](ctx, r[1]));
    if ((r = pick(NECK, o.neck))) slots.neck.add(r[0](ctx, r[1]));
    const top = pick(TOPS, o.top);
    if (top) { const tp = top[0](ctx, top[1]); slots.top.add(tp.body); tp.sleeves?.forEach((s, i) => sleeveSlots[i].add(s)); }
    const topKind = typeof o.top === 'string' ? o.top : o.top?.kind;
    belly.visible = !(top && (topKind === 'sweater' || topKind === 'jacket'));   // roupa fechada esconde a barriga
    if ((r = pick(PETS, o.pet))) { const p = r[0](ctx, r[1]); const side = r[1].side === 'L' ? -1 : 1; p.position.set(side * (bodyRadiusAt(1.02) + 0.03), 1.03, 0.08); p.rotation.y = side * 0.6; p.scale.setScalar(1.2); slots.pet.add(p); }
    const fw = pick(FOOTWEAR, o.footwear ?? 'sneaker');
    if (fw) shoeSlots.forEach((s, i) => s.add(fw[0](ctx, fw[1], i === 0 ? -1 : 1)));
    ([[0, o.propL], [1, o.propR]] as const).forEach(([i, spec]) => {
      const pr = pick(PROPS, spec); if (!pr) return;
      const { obj, upright } = pr[0](ctx, pr[1]); handSockets[i].add(obj);
      if (upright) uprightProps.push(obj); else obj.rotation.x = Math.PI / 2 * 0.9;
    });
    if (o.expression) setExpression(o.expression, true);
    if (o.arms) setArms(o.arms, true);
    group.traverse((m) => { if (m instanceof THREE.Mesh) { m.castShadow = !ghost; m.receiveShadow = !ghost; } });
    applyFirstPerson();
  }

  let firstPerson = false;
  function applyFirstPerson() {
    const hidden = firstPerson;
    face.visible = !hidden;
    for (const g of [slots.hat, slots.hair, slots.top, slots.neck, slots.pet]) g.visible = !hidden;
  }

  const allMaterials = () => [...baseColors.keys()];

  applyPose(cur, 1); applyArms(armCur);
  setOutfit(opts.outfit ?? {});

  return {
    group, materials: mats, update,
    handSockets: [handSockets[0], handSockets[1]],
    setExpression, setArms,
    setOutfit, getOutfit: () => ({ ...outfit }),
    setAnimation(name) {
      if (name === 'Jump' || name === 'Bounce') { if (anim !== name) { if (anim === 'Idle' || anim === 'Walk') animAfter = anim; anim = name; oneShotT = 0; } return; }
      if (anim === 'Jump' || anim === 'Bounce') { animAfter = name; return; }
      anim = name; animT = 0; oneShotT = -1;
    },
    jump() { this.setAnimation('Jump'); },
    bounce() { this.setAnimation('Bounce'); },
    getAnimation: () => anim,
    setSeated(v) { seated = v; },
    isSeated: () => seated,
    setWalkSpeed(v) { walkSpeed = v; },
    setLook(yaw, pitch) { look.yaw = yaw; look.pitch = pitch; },
    setLean(v) { look.lean = THREE.MathUtils.clamp(v, 0, 1); },
    setTalking(v) { talking = v; },
    setBlinking(v) { blinking = v; },
    setDimmed(v) { for (const m of allMaterials()) m.color.copy(baseColors.get(m)!).multiplyScalar(v ? 0.5 : 1); },
    setFirstPerson(v) { firstPerson = v; applyFirstPerson(); },
    dispose() { group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); for (const m of allMaterials()) m.dispose(); },
  };
}
