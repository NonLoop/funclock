import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("webgl");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = matchMedia("(max-width: 680px)").matches;
const dprCap = isMobile ? 1.5 : 2;

const VOID = 0x01040a;
const CYAN = new THREE.Color(0x67e8f9);
const VIOLET = new THREE.Color(0xc4b5fd);
const MINT = new THREE.Color(0xa5f3fc);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
  stencil: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(VOID, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);
scene.fog = new THREE.FogExp2(VOID, 0.045);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 120);
// Idle: slightly off-center so left copy has breathing room; detail mode recenters
const camIdle = new THREE.Vector3(isMobile ? 0 : 1.35, 1.15, 9.8);
const camFocus = new THREE.Vector3(0, 0.35, 6.8);
const targetIdle = new THREE.Vector3(isMobile ? 0 : 0.85, 0.05, 0);
const targetFocus = new THREE.Vector3(0, 0, 0);
camera.position.copy(camIdle);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.048;
controls.minDistance = 4.2;
controls.maxDistance = 22;
controls.enablePan = false;
controls.autoRotate = false;
controls.maxPolarAngle = Math.PI * 0.88;
controls.minPolarAngle = Math.PI * 0.12;
controls.target.copy(targetIdle);

window.__sceneFocus = 0;
let focusAmt = 0;

// Soft environment for transmission reflections
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
{
  const g = new THREE.Mesh(
    new THREE.SphereGeometry(12, 32, 32),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        cA: { value: new THREE.Color(0x041018) },
        cB: { value: new THREE.Color(0x1a0a2e) },
        cC: { value: new THREE.Color(0x0a2a38) },
      },
      vertexShader: `
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 cA; uniform vec3 cB; uniform vec3 cC;
        varying vec3 vN;
        void main() {
          float u = vN.y * 0.5 + 0.5;
          float v = vN.x * 0.5 + 0.5;
          vec3 col = mix(cA, cB, u);
          col = mix(col, cC, v * 0.55);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  envScene.add(g);
}
scene.environment = pmrem.fromScene(envScene, 0.04).texture;
pmrem.dispose();
envScene.traverse((o) => {
  if (o.geometry) o.geometry.dispose();
  if (o.material) o.material.dispose();
});

scene.add(new THREE.AmbientLight(0x4a6080, 0.35));
const key = new THREE.PointLight(0x67e8f9, 42, 40, 2);
key.position.set(5, 6, 4);
scene.add(key);
const fill = new THREE.PointLight(0xa78bfa, 28, 36, 2);
fill.position.set(-6, -2, 3);
scene.add(fill);
const rim = new THREE.PointLight(0xe0f2fe, 12, 28, 2);
rim.position.set(0, 4, -5);
scene.add(rim);

// --- Crystal material (transmission + fresnel-adjacent rim via emissive pulse) ---
function makeCrystalMat(tint, emissiveStrength = 0.18) {
  return new THREE.MeshPhysicalMaterial({
    color: tint,
    metalness: 0.05,
    roughness: 0.06,
    transmission: 0.92,
    thickness: 1.35,
    ior: 1.55,
    transparent: true,
    opacity: 1,
    envMapIntensity: 1.4,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    specularIntensity: 1,
    specularColor: new THREE.Color(0xffffff),
    emissive: tint.clone().multiplyScalar(0.35),
    emissiveIntensity: emissiveStrength,
    side: THREE.FrontSide,
    depthWrite: false,
  });
}

const mats = [
  makeCrystalMat(new THREE.Color(0xb8f4ff), 0.22),
  makeCrystalMat(new THREE.Color(0xd4c4ff), 0.2),
  makeCrystalMat(new THREE.Color(0x9ef0e8), 0.18),
  makeCrystalMat(new THREE.Color(0xc8e7ff), 0.16),
];

// Edge glow wire shells (cyan→violet)
function makeEdgeMat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const cluster = new THREE.Group();
cluster.position.set(isMobile ? 0 : 1.15, 0.06, 0);
scene.add(cluster);

const FRAG_N = reduced ? 28 : (isMobile ? 48 : 72);
const fragments = [];
const tetraGeo = new THREE.TetrahedronGeometry(1, 0);

function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

for (let i = 0; i < FRAG_N; i++) {
  const r0 = seeded(i);
  const r1 = seeded(i + 17);
  const r2 = seeded(i + 41);
  const r3 = seeded(i + 73);
  const r4 = seeded(i + 99);

  const scale = 0.12 + r0 * 0.55;
  const mesh = new THREE.Mesh(tetraGeo, mats[i % mats.length]);
  mesh.scale.setScalar(scale);

  // Nested edge wire for fresnel-like rim
  const edge = new THREE.Mesh(
    tetraGeo,
    makeEdgeMat(i % 2 === 0 ? 0x67e8f9 : 0xc4b5fd, 0.22 + r1 * 0.25)
  );
  edge.scale.setScalar(1.02);
  mesh.add(edge);

  const theta = r1 * Math.PI * 2;
  const phi = Math.acos(2 * r2 - 1);
  const radius = 1.1 + r3 * 4.2;

  const base = new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta) * 0.72,
    radius * Math.cos(phi)
  );

  mesh.position.copy(base);
  mesh.rotation.set(r0 * Math.PI, r1 * Math.PI, r2 * Math.PI);
  mesh.renderOrder = 1;

  cluster.add(mesh);
  fragments.push({
    mesh,
    edge,
    base,
    scale,
    spin: new THREE.Vector3(
      (r0 - 0.5) * 0.6,
      (r1 - 0.5) * 0.8,
      (r2 - 0.5) * 0.5
    ),
    phase: r3 * Math.PI * 2,
    orbit: 0.15 + r4 * 0.55,
    layer: Math.floor(r0 * 3),
  });
}

// Micro dust
const DUST_N = reduced ? 80 : (isMobile ? 220 : 480);
const dustPos = new Float32Array(DUST_N * 3);
const dustVel = new Float32Array(DUST_N);
const dustLife = new Float32Array(DUST_N);
const dustAge = new Float32Array(DUST_N);
const dustPhase = new Float32Array(DUST_N);

function respawnDust(i, cold = false) {
  const r = 0.4 + Math.random() * 7.5;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  dustPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  dustPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
  dustPos[i * 3 + 2] = r * Math.cos(phi);
  dustVel[i] = 0.08 + Math.random() * 0.35;
  dustLife[i] = 4 + Math.random() * 10;
  dustAge[i] = cold ? Math.random() * dustLife[i] : 0;
  dustPhase[i] = Math.random() * Math.PI * 2;
}

for (let i = 0; i < DUST_N; i++) respawnDust(i, true);

const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
const dustColors = new Float32Array(DUST_N * 3);
for (let i = 0; i < DUST_N; i++) {
  const c = i % 3 === 0 ? CYAN : i % 3 === 1 ? VIOLET : MINT;
  dustColors[i * 3] = c.r;
  dustColors[i * 3 + 1] = c.g;
  dustColors[i * 3 + 2] = c.b;
}
dustGeo.setAttribute("color", new THREE.BufferAttribute(dustColors, 3));

const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    size: isMobile ? 0.028 : 0.018,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    vertexColors: true,
  })
);
scene.add(dust);

// Far starfield
const STAR_N = isMobile ? 200 : 500;
const starPos = new Float32Array(STAR_N * 3);
for (let i = 0; i < STAR_N; i++) {
  const r = 28 + Math.random() * 40;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPos[i * 3 + 2] = r * Math.cos(phi);
}
const stars = new THREE.Points(
  new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(starPos, 3)),
  new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.035,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    sizeAttenuation: true,
  })
);
scene.add(stars);

// Soft central glow orb (not a clock)
const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.35, 1),
  new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
cluster.add(core);
const coreWire = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.38, 0),
  makeEdgeMat(0x67e8f9, 0.35)
);
cluster.add(coreWire);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight),
  isMobile ? 0.85 : 1.25,
  0.55,
  0.55
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);

const clock = new THREE.Clock();
let last = 0;
const frameInterval = 1000 / (isMobile ? 45 : 60);

function timeParams(d) {
  const ms = d.getMilliseconds() / 1000;
  const s = d.getSeconds() + ms;
  const m = d.getMinutes() + s / 60;
  const h = d.getHours() + m / 60;
  // Smooth cyclic drivers — never mapped to hand angles
  return {
    sNorm: s / 60,
    mNorm: m / 60,
    hNorm: (h % 24) / 24,
    secPulse: Math.sin(s * Math.PI * 2),
    minBreath: Math.sin(m * Math.PI * 2),
    hourDrift: Math.sin(h * Math.PI * 2 / 24),
    s, m, h,
  };
}

function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < frameInterval) return;
  const dt = Math.min(0.05, (now - last) / 1000) || 0.016;
  last = now;

  const t = clock.getElapsedTime();
  const tp = timeParams(new Date());

  // Smooth focus: idle (offset) → detail (centered / closer)
  const focusTarget = window.__sceneFocus ? 1 : 0;
  focusAmt += (focusTarget - focusAmt) * Math.min(1, dt * 2.4);
  const ease = focusAmt * focusAmt * (3 - 2 * focusAmt);
  const transitioning = Math.abs(focusTarget - focusAmt) > 0.01;

  if (transitioning) {
    const desiredCam = camIdle.clone().lerp(camFocus, ease);
    const desiredTarget = targetIdle.clone().lerp(targetFocus, ease);
    const pull = 1 - Math.pow(0.0005, dt);
    camera.position.lerp(desiredCam, pull);
    controls.target.lerp(desiredTarget, pull);
  }

  cluster.position.x = THREE.MathUtils.lerp(isMobile ? 0 : 1.15, 0, ease);
  cluster.position.y = THREE.MathUtils.lerp(0.06, 0, ease);
  cluster.scale.setScalar(THREE.MathUtils.lerp(1, 0.88, ease));

  // Cluster rotation driven by time of day
  cluster.rotation.y = t * 0.04 + tp.hNorm * Math.PI * 2 * 0.35 + tp.mNorm * 0.4;
  cluster.rotation.x = tp.hourDrift * 0.18 + Math.sin(t * 0.11) * 0.05;
  cluster.rotation.z = tp.minBreath * 0.08;

  // Dispersion: seconds expand; detail mode gently gathers crystals
  const disperse =
    (1 +
      tp.sNorm * 0.55 +
      tp.minBreath * 0.12 +
      Math.sin(t * 0.3) * 0.04) *
    THREE.MathUtils.lerp(1, 0.68, ease);

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];
    const layerMul = 1 + f.layer * 0.08 * tp.sNorm;
    const wobble = 1 + Math.sin(t * f.orbit + f.phase) * 0.06 * (0.5 + tp.sNorm);
    const rad = disperse * layerMul * wobble;

    f.mesh.position.set(
      f.base.x * rad,
      f.base.y * rad + Math.sin(t * 0.4 + f.phase) * 0.08,
      f.base.z * rad
    );

    f.mesh.rotation.x += f.spin.x * dt * (0.6 + tp.sNorm);
    f.mesh.rotation.y += f.spin.y * dt * (0.5 + tp.mNorm);
    f.mesh.rotation.z += f.spin.z * dt * (0.4 + tp.hNorm);

    // Scale breath with second pulse
    const sPulse = 1 + tp.secPulse * 0.04 * (f.layer + 1) * 0.35;
    f.mesh.scale.setScalar(f.scale * sPulse);

    if (f.edge.material) {
      f.edge.material.opacity = 0.18 + (0.5 + 0.5 * tp.secPulse) * 0.28;
    }
  }

  // Core pulse tied to seconds without being a dial
  const coreScale = 0.85 + tp.sNorm * 0.55 + Math.sin(t * 2.2) * 0.05;
  core.scale.setScalar(coreScale);
  coreWire.scale.setScalar(coreScale * 1.08);
  coreWire.rotation.y = t * 0.2 + tp.mNorm * Math.PI;
  coreWire.rotation.x = t * 0.12;

  // Dust birth / fade driven by seconds
  const birthRate = 0.35 + tp.sNorm * 1.4;
  for (let i = 0; i < DUST_N; i++) {
    dustAge[i] += dt * birthRate;
    if (dustAge[i] >= dustLife[i]) respawnDust(i, false);

    const lifeT = dustAge[i] / dustLife[i];
    // Drift
    dustPos[i * 3 + 1] += Math.sin(t * dustVel[i] + dustPhase[i]) * 0.003;
    dustPos[i * 3] += Math.cos(t * dustVel[i] * 0.7 + dustPhase[i]) * 0.0015;

    // Soft fade envelope used via overall material + positional shrink near death
    if (lifeT > 0.85) {
      dustPos[i * 3] *= 1.001;
      dustPos[i * 3 + 2] *= 1.001;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
  dust.material.opacity = 0.25 + tp.sNorm * 0.4 + Math.sin(t * 0.8) * 0.05;
  dust.rotation.y = t * 0.02 + tp.mNorm * 0.3;

  stars.rotation.y = t * 0.004;
  stars.rotation.x = tp.hNorm * 0.15;

  key.intensity = 36 + tp.secPulse * 8;
  fill.intensity = 22 + tp.minBreath * 6;
  bloom.strength = (isMobile ? 0.75 : 1.1) + tp.sNorm * 0.25;

  mats.forEach((m, idx) => {
    const mix = (Math.sin(t * 0.5 + idx) * 0.5 + 0.5);
    m.emissiveIntensity = 0.12 + mix * 0.18 + tp.sNorm * 0.1;
  });

  controls.update();
  composer.render();
}

if (!reduced) requestAnimationFrame(frame);
else {
  controls.update();
  composer.render();
}
