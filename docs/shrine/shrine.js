import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("SHRINE JS — camera orbit + 3D donation wall", Date.now());

// ====== CONFIG ======
const BASE = "/gongdewuliang";
const MODEL_DIR = `${BASE}/assets/models/gen_god/`;

const PATHS = {
  obj: `${MODEL_DIR}base.obj`,
  diffuse: `${MODEL_DIR}texture_diffuse.png`,
  normal: `${MODEL_DIR}texture_normal.png`,
  roughness: `${MODEL_DIR}texture_roughness.png`,
  metallic: `${MODEL_DIR}texture_metallic.png`,
};

const BLESS_MS = 60_000;      // each small idol lasts 1 minute
const FADE_MS = 6_000;        // fade during last 6 seconds (set to 0 for instant vanish)

const WALL = {
  cols: 24,
  rows: 12,
  spacingX: 1.25,
  spacingY: 1.15,
  z: -18.0,        // behind main idol
  y0: 0.6,         // start height
};

const CAMERA = {
  autoSpeed: 0.22,       // radians/sec
  pauseAfterInputMs: 3500,
};

// ====== DOM ======
const canvas = document.getElementById("scene");
const testBtn = document.getElementById("test-donate");

// ====== AUDIO (default ON) ======
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 0.72;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ====== THREE SETUP ======
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true, // keep transparent so your white page / wall shows through
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
camera.position.set(0, 11.0, 46.0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.set(0, 8.0, 0);
controls.update();

// Warm-ish lights
scene.add(new THREE.AmbientLight(0xffffff, 0.62));
const warmKey = new THREE.DirectionalLight(0xfff1dd, 1.05);
warmKey.position.set(6, 10, 8);
scene.add(warmKey);
const fill = new THREE.DirectionalLight(0xeaf0ff, 0.25);
fill.position.set(-7, 6, -7);
scene.add(fill);

// ====== LOAD TEXTURES + OBJ ======
const manager = new THREE.LoadingManager();
manager.onError = (url) => console.error("[load] failed:", url);
const texLoader = new THREE.TextureLoader(manager);

function loadTex(url, { srgb = false } = {}) {
  const t = texLoader.load(
    url,
    () => console.log("[tex] ok:", url),
    undefined,
    () => console.warn("[tex] missing:", url)
  );
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const diffuseMap = loadTex(PATHS.diffuse, { srgb: true });
const normalMap = loadTex(PATHS.normal);
const roughnessMap = loadTex(PATHS.roughness);
const metalnessMap = loadTex(PATHS.metallic);

// Main idol material (your textured look)
const mainMat = new THREE.MeshStandardMaterial({
  map: diffuseMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  roughness: 0.9,
  metalness: 0.05,
});

// Donation mini idols: bright/glowy, warm-ish
function makeMiniMaterialFrom(baseMat) {
  const m = baseMat.clone();
  m.transparent = true;
  m.opacity = 1;
  m.emissive = new THREE.Color(0xfff3e5);
  m.emissiveIntensity = 0.9;
  m.metalness = 0.02;
  m.roughness = 0.55;
  return m;
}

const objLoader = new OBJLoader(manager);
let godObj = null;
let godTemplate = null; // used to clone minis
let mainScale = 1;

// Mini idol pool
const minis = []; // { group, createdAt, expiresAt, username, amount }
let nextMiniIndex = 0;

function cloneAsMini(templateGroup) {
  const clone = templateGroup.clone(true);

  // IMPORTANT: give each mesh its own material instance so opacity fades per-mini
  clone.traverse((child) => {
    if (child && child.isMesh) {
      child.material = makeMiniMaterialFrom(mainMat);
      child.castShadow = false;
      child.receiveShadow = false;
      if (child.geometry) child.geometry.computeVertexNormals();
    }
  });

  return clone;
}

function placeMiniInGrid(miniGroup, index) {
  const c = index % WALL.cols;
  const r = Math.floor(index / WALL.cols) % WALL.rows;

  const totalW = (WALL.cols - 1) * WALL.spacingX;
  const x = (c * WALL.spacingX) - totalW / 2;
  const y = WALL.y0 + r * WALL.spacingY;
  const z = WALL.z;

  miniGroup.position.set(x, y, z);

  // small random facing so it’s not too perfect
  miniGroup.rotation.y = Math.PI + (Math.random() - 0.5) * 0.25;
}

function setGroupOpacity(group, alpha) {
  group.traverse((child) => {
    if (child && child.isMesh && child.material) {
      child.material.transparent = true;
      child.material.opacity = alpha;
      child.material.needsUpdate = true;
    }
  });
}

function spawnMini({ username, amount }) {
  if (!godTemplate) return;

  const mini = cloneAsMini(godTemplate);

  // scale: relative to main idol size
  const miniScale = mainScale * 0.18; // tweak if you want smaller/larger
  mini.scale.setScalar(miniScale);

  placeMiniInGrid(mini, nextMiniIndex++);
  scene.add(mini);

  const createdAt = Date.now();
  const expiresAt = createdAt + BLESS_MS;

  minis.push({ group: mini, createdAt, expiresAt, username, amount });

  // voice
  speak(`感谢善信 ${username}，供奉 ${amount} 元。功德无量。`);
}

// ====== CAMERA AUTO-ROTATION (instead of idol rotation) ======
const clock = new THREE.Clock();
let autoAngle = 0;

// Pause auto-rotate briefly after user interacts
let autoPauseUntil = 0;
function pauseAutoRotate() {
  autoPauseUntil = Date.now() + CAMERA.pauseAfterInputMs;
}

// Track user input on canvas
canvas.addEventListener("pointerdown", pauseAutoRotate);
canvas.addEventListener("wheel", pauseAutoRotate, { passive: true });
canvas.addEventListener("touchstart", pauseAutoRotate, { passive: true });

function autoRotateCamera(dt) {
  if (Date.now() < autoPauseUntil) return;

  const target = controls.target;

  // Keep current radius + height, just orbit around Y
  const dx = camera.position.x - target.x;
  const dz = camera.position.z - target.z;
  const radius = Math.max(0.001, Math.hypot(dx, dz));
  const y = camera.position.y;

  autoAngle += dt * CAMERA.autoSpeed;

  camera.position.x = target.x + Math.sin(autoAngle) * radius;
  camera.position.z = target.z + Math.cos(autoAngle) * radius;
  camera.position.y = y;

  camera.lookAt(target);
}

// ====== LOAD MAIN OBJ ======
objLoader.load(
  PATHS.obj,
  (obj) => {
    obj.traverse((child) => {
      if (child && child.isMesh) {
        child.material = mainMat;
        if (child.geometry) child.geometry.computeVertexNormals();
      }
    });

    // Center & scale
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    obj.position.x -= center.x;
    obj.position.z -= center.z;

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    mainScale = 18.0 / maxDim;
    obj.scale.setScalar(mainScale);

    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y += (0.0 - box2.min.y);

    obj.rotation.y = Math.PI;

    scene.add(obj);
    godObj = obj;

    // Save template for mini clones (clone from the already-centered OBJ)
    godTemplate = obj.clone(true);

    // Reset camera view nicely + initialize autoAngle to current camera angle
    controls.reset();
    controls.target.set(0, 8.0, 0);
    camera.position.set(0, 11.0, 46.0);
    camera.lookAt(controls.target);
    controls.update();

    // compute initial autoAngle from camera position
    {
      const dx = camera.position.x - controls.target.x;
      const dz = camera.position.z - controls.target.z;
      autoAngle = Math.atan2(dx, dz);
    }

    console.log("[obj] loaded main idol + template:", PATHS.obj);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== DONATION HOOKS ======
window.gongdeDonate = function gongdeDonate({ username, amount }) {
  spawnMini({ username: String(username), amount: String(amount) });
};

const chan = ("BroadcastChannel" in window) ? new BroadcastChannel("gongde") : null;
if (chan) {
  chan.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== "donation") return;
    window.gongdeDonate({
      username: msg.username || "善信",
      amount: msg.amount || "0",
    });
  };
}

// Test button -> makes a new mini idol
testBtn?.addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  window.gongdeDonate({ username, amount });
});

// ====== Resize ======
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ====== RENDER LOOP ======
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();

  // Let user orbit freely, but also auto-orbit camera when idle
  controls.update();
  autoRotateCamera(dt);

  // Fade & remove expired minis
  const t = Date.now();
  for (let i = minis.length - 1; i >= 0; i--) {
    const m = minis[i];
    const remaining = m.expiresAt - t;

    if (remaining <= 0) {
      // remove immediately at end
      scene.remove(m.group);
      minis.splice(i, 1);
      continue;
    }

    if (FADE_MS > 0 && remaining < FADE_MS) {
      const alpha = THREE.MathUtils.clamp(remaining / FADE_MS, 0, 1);
      setGroupOpacity(m.group, alpha);
    }
  }

  renderer.render(scene, camera);
});
