import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("SHRINE JS — white bg + bigger spaced minis", Date.now());

// ====== CONFIG ======
const BASE = "/gongdewuliang";
const MODEL_DIR = `${BASE}/assets/models/gen_god/`;

const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw";

const PATHS = {
  obj: `${MODEL_DIR}base.obj`,
  diffuse: `${MODEL_DIR}texture_diffuse.png`,
  normal: `${MODEL_DIR}texture_normal.png`,
  roughness: `${MODEL_DIR}texture_roughness.png`,
  metallic: `${MODEL_DIR}texture_metallic.png`,
};

const BLESS_MS = 60_000;  // minis last 1 minute
const FADE_MS = 5000;     // fade over last 5s (0 = instant)

// ✅ Wall layout: more spacing, fewer columns so it looks clean
const WALL = {
  cols: 14,
  rows: 7,
  spacingX: 5.0,
  spacingY: 3.0,
  z: -36.0,
  y0: 1.2,
};

const MAIN = {
  targetSize: 18.0,
  rotateSpeed: 0.55,
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = null;

renderer.sortObjects = true;

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
camera.position.set(0, 11.0, 46.0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.set(0, 8.0, 0);
controls.update();

// Lights (slightly warm)
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

const mainMat = new THREE.MeshStandardMaterial({
  map: diffuseMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  roughness: 0.85,
  metalness: 0.08,
});

// Minis: warm gold-ish and solid
function makeMiniMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffe3b0,
    metalness: 0.65,
    roughness: 0.35,
    emissive: new THREE.Color(0x2a1a08),
    emissiveIntensity: 0.15,
  });
  m.transparent = false;
  m.opacity = 1;
  return m;
}

const objLoader = new OBJLoader(manager);
let godObj = null;
let godTemplate = null;
let mainScale = 1;

// Queue donations until model is loaded
const pendingDonations = [];

// Mini pool
const minis = []; // { group, createdAt, expiresAt }
let nextMiniIndex = 0;

function cloneAsMini(templateGroup) {
  const clone = templateGroup.clone(true);
  clone.traverse((child) => {
    if (child && child.isMesh) {
      child.material = makeMiniMaterial();
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

  // ✅ face forward
  miniGroup.rotation.set(0, (Math.random() - 0.5) * 0.12, 0);
}

function setGroupOpacity(group, alpha) {
  group.traverse((child) => {
    if (child && child.isMesh && child.material) {
      if (alpha >= 0.999) {
        child.material.transparent = false;
        child.material.opacity = 1;
        child.material.depthWrite = true;
      } else {
        child.material.transparent = true;
        child.material.opacity = alpha;
        child.material.depthWrite = false;
      }
      child.material.needsUpdate = true;
    }
  });
}

function spawnMini({ username, amount }) {
  if (!godTemplate) {
    pendingDonations.push({ username, amount });
    return;
  }

  const mini = cloneAsMini(godTemplate);

  // ✅ bigger minis
  const miniScale = mainScale * 0.44; // try 0.40–0.52
  mini.scale.setScalar(miniScale);

  placeMiniInGrid(mini, nextMiniIndex++);
  scene.add(mini);

  const createdAt = Date.now();
  const expiresAt = createdAt + BLESS_MS;
  minis.push({ group: mini, createdAt, expiresAt });

  speak(`感谢善信 ${username}，供奉 ${amount} 元。功德无量。`);
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

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    obj.position.x -= center.x;
    obj.position.z -= center.z;

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    mainScale = MAIN.targetSize / maxDim;
    obj.scale.setScalar(mainScale);

    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y += (0.0 - box2.min.y);

    obj.rotation.y = Math.PI;

    scene.add(obj);
    godObj = obj;

    godTemplate = obj.clone(true);

    while (pendingDonations.length) spawnMini(pendingDonations.shift());

    console.log("[obj] loaded main idol + template:", PATHS.obj);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== Donation hooks ======
window.gongdeDonate = function gongdeDonate({ username, amount }) {
  spawnMini({ username: String(username), amount: String(amount) });
};

// ===== Supabase Realtime =====
async function startRealtime() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  supabase
    .channel("gongde-donations")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "donations" }, (payload) => {
      const row = payload.new;
      const name = row.name || row.username || "善信";
      const amount = row.amount ?? 0;
      console.log("[realtime] donation received:", row);
      window.gongdeDonate({ username: String(name), amount: String(amount) });
    })
    .subscribe((status) => console.log("[realtime] status:", status));
}
startRealtime();

// optional same-device testing
const chan = ("BroadcastChannel" in window) ? new BroadcastChannel("gongde") : null;
if (chan) {
  chan.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== "donation") return;
    window.gongdeDonate({ username: msg.username || "善信", amount: msg.amount || "0" });
  };
}

// Test button
testBtn?.addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  window.gongdeDonate({ username, amount });
});

// Resize
function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Render loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  controls.update();

  if (godObj) godObj.rotation.y += dt * MAIN.rotateSpeed;

  const t = Date.now();
  for (let i = minis.length - 1; i >= 0; i--) {
    const m = minis[i];
    const remaining = m.expiresAt - t;

    if (remaining <= 0) {
      scene.remove(m.group);
      minis.splice(i, 1);
      continue;
    }

    if (FADE_MS > 0 && remaining < FADE_MS) {
      const alpha = THREE.MathUtils.clamp(remaining / FADE_MS, 0, 1);
      setGroupOpacity(m.group, alpha);
    } else {
      setGroupOpacity(m.group, 1);
    }
  }

  renderer.render(scene, camera);
});
