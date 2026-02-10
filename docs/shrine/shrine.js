import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("SHRINE JS — 2D mask wall + 3D rotating idol", Date.now());

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

const REVEAL_MS = 60_000;
const STORAGE_KEY = "gongde_wall_v1";

// ====== DOM ======
const wallEl = document.getElementById("buddha-wall");
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

// ====== WALL STATE ======
const donations = new Map(); // idx -> { username, amount, expiresAt }
const timers = new Map();    // idx -> { expireTimer, cleanupTimer }

function now() { return Date.now(); }

function saveState() {
  const payload = [];
  for (const [idx, rec] of donations.entries()) payload.push([idx, rec]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  donations.clear();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;

    for (const [idx, rec] of arr) {
      if (!rec || typeof rec.expiresAt !== "number") continue;
      if (rec.expiresAt <= now()) continue;
      donations.set(Number(idx), rec);
    }
  } catch (_) {}
}

function clearTileTimers(idx) {
  const t = timers.get(idx);
  if (!t) return;
  clearTimeout(t.expireTimer);
  clearTimeout(t.cleanupTimer);
  timers.delete(idx);
}

function applyTileState(idx) {
  const tile = wallEl.querySelector(`.wall-tile[data-idx="${idx}"]`);
  if (!tile) return;

  const rec = donations.get(idx);
  const label = tile.querySelector(".label");

  tile.classList.remove("revealed", "expiring");
  if (label) label.textContent = "";

  if (!rec) return;

  if (label) label.textContent = `${rec.username}  ¥${rec.amount}`;
  tile.classList.add("revealed");

  clearTileTimers(idx);

  const msLeft = Math.max(0, rec.expiresAt - now());

  const expireTimer = setTimeout(() => {
    tile.classList.remove("revealed");
    tile.classList.add("expiring");
  }, msLeft);

  const cleanupTimer = setTimeout(() => {
    donations.delete(idx);
    saveState();
    tile.classList.remove("expiring");
    if (label) label.textContent = "";
  }, msLeft + 1600);

  timers.set(idx, { expireTimer, cleanupTimer });
}

function revealAnyTile({ username, amount }) {
  const tiles = wallEl.querySelectorAll(".wall-tile");
  const hidden = [];
  tiles.forEach((t) => {
    const idx = Number(t.dataset.idx);
    if (!donations.has(idx)) hidden.push(idx);
  });

  let idx;
  if (hidden.length > 0) {
    idx = hidden[Math.floor(Math.random() * hidden.length)];
  } else {
    let bestIdx = 0;
    let bestExpires = Infinity;
    for (const [k, rec] of donations.entries()) {
      if (rec.expiresAt < bestExpires) {
        bestExpires = rec.expiresAt;
        bestIdx = k;
      }
    }
    idx = bestIdx;
  }

  const rec = { username, amount, expiresAt: now() + REVEAL_MS };
  donations.set(idx, rec);
  saveState();
  applyTileState(idx);

  return idx; // mapping
}

// Public hook for /pay later
window.gongdeDonate = function gongdeDonate({ username, amount }) {
  const tileIndex = revealAnyTile({ username, amount });
  speak(`感谢善信 ${username}，供奉 ${amount} 元。功德无量。`);
  return { tileIndex };
};

// BroadcastChannel hook for /pay later
const chan = ("BroadcastChannel" in window) ? new BroadcastChannel("gongde") : null;
if (chan) {
  chan.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.type !== "donation") return;
    const username = String(msg.username || "善信");
    const amount = String(msg.amount || "0");
    window.gongdeDonate({ username, amount });
  };
}

// ====== BUILD WALL GRID (fills screen) ======
function computeWallCols() {
  const w = window.innerWidth;
  if (w >= 1400) return 34;
  if (w >= 1100) return 30;
  if (w >= 900) return 26;
  if (w >= 700) return 22;
  return 16;
}

function buildWall() {
  for (const idx of timers.keys()) clearTileTimers(idx);
  timers.clear();

  wallEl.innerHTML = "";

  const cols = computeWallCols();
  wallEl.style.setProperty("--wall-cols", String(cols));

  const tilePx = (window.innerWidth - 36) / cols;
  const rows = Math.ceil((window.innerHeight - 36) / (tilePx + 8)) + 2;

  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement("div");
      tile.className = "wall-tile";
      tile.dataset.idx = String(idx);

      const sigil = document.createElement("div");
      sigil.className = "sigil";

      const label = document.createElement("div");
      label.className = "label";

      const cover = document.createElement("div");
      cover.className = "cover";

      tile.appendChild(sigil);
      tile.appendChild(label);
      tile.appendChild(cover);

      wallEl.appendChild(tile);
      idx++;
    }
  }

  for (const key of donations.keys()) applyTileState(key);
}

// ====== THREE (3D idol only, transparent over wall) ======
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
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

// Textures + OBJ
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
  roughness: 0.9,
  metalness: 0.05,
});

const objLoader = new OBJLoader(manager);
let godObj = null;

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
    obj.scale.setScalar(18.0 / maxDim);

    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y += (0.0 - box2.min.y);

    obj.rotation.y = Math.PI;

    scene.add(obj);
    godObj = obj;

    console.log("[obj] loaded:", PATHS.obj);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== TEST DONATION ======
testBtn?.addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  const res = window.gongdeDonate({ username, amount });
  console.log("[donation] tile:", res.tileIndex);
});

// ====== Resize ======
function resize() {
  buildWall();

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ====== INIT ======
loadState();
buildWall();
resize();

// ====== Render loop ======
renderer.setAnimationLoop(() => {
  controls.update();

  // ✅ Main idol rotates again (slow & ceremonial)
  if (godObj) godObj.rotation.y += 0.0012;

  renderer.render(scene, camera);
});
