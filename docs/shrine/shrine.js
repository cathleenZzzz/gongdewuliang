import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("SHRINE JS — amber niches + bigger minis", Date.now());

// ====== CONFIG ======
const BASE = "/gongdewuliang";
const MODEL_DIR = `${BASE}/assets/models/gen_god/`;

// ✅ your real values (already correct)
const SUPABASE_URL = "https://gsmkpxxjzrtpdvgocbex.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_bUv7a7CgIOiIMRHjMhIAFg_8W_IHlGw";

const PATHS = {
  obj: `${MODEL_DIR}base.obj`,
  diffuse: `${MODEL_DIR}texture_diffuse.png`,
  normal: `${MODEL_DIR}texture_normal.png`,
  roughness: `${MODEL_DIR}texture_roughness.png`,
  metallic: `${MODEL_DIR}texture_metallic.png`,
};

const BLESS_MS = 60_000;   // minis last 1 minute
const FADE_MS = 5000;      // fade over last 5s (0 = instant)

// Wall layout (like temple niche wall)
const WALL = {
  cols: 16,
  rows: 8,
  spacingX: 3.2,
  spacingY: 3.35,
  z: -34.0,
  y0: 2.0,
};

// Main idol
const MAIN = {
  targetSize: 18.0,
  rotateSpeed: 0.45, // slower = more “ceremonial”
};

// Minis
const MINI = {
  // 🔥 bigger minis (this is the main change)
  scaleFactor: 0.34,      // was ~0.16; try 0.30–0.38
  // niche look
  nichePadX: 1.35,
  nichePadY: 1.28,
  nicheDepth: 0.28,
};

// ====== DOM ======
const canvas = document.getElementById("scene");
const testBtn = document.getElementById("test-donate");

// ====== AUDIO (default ON) ======
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.01;
  u.pitch = 0.70;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// ====== THREE SETUP ======
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.sortObjects = true;

const scene = new THREE.Scene();
scene.background = null;

// a little haze for “glow room”
scene.fog = new THREE.Fog(new THREE.Color(0x070606), 38, 120);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
camera.position.set(0, 12.0, 46.0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.set(0, 9.0, 0);
controls.update();

// Lights: warm shrine LED
scene.add(new THREE.AmbientLight(0xffffff, 0.40));

const warmKey = new THREE.DirectionalLight(0xffe1b8, 1.15);
warmKey.position.set(8, 12, 10);
scene.add(warmKey);

const warmFill = new THREE.DirectionalLight(0xffc98d, 0.25);
warmFill.position.set(-10, 6, 4);
scene.add(warmFill);

const coolBack = new THREE.DirectionalLight(0xcfe0ff, 0.12);
coolBack.position.set(-6, 10, -12);
scene.add(coolBack);

// ====== LOAD TEXTURES + OBJ ======
const manager = new THREE.LoadingManager();
manager.onError = (url) => console.error("[load] failed:", url);
const texLoader = new THREE.TextureLoader(manager);

function loadTex(url, { srgb = false } = {}) {
  const t = texLoader.load(url, () => console.log("[tex] ok:", url));
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const diffuseMap = loadTex(PATHS.diffuse, { srgb: true });
const normalMap = loadTex(PATHS.normal);
const roughnessMap = loadTex(PATHS.roughness);
const metalnessMap = loadTex(PATHS.metallic);

// Main idol material (your texture set)
const mainMat = new THREE.MeshStandardMaterial({
  map: diffuseMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  roughness: 0.85,
  metalness: 0.08,
});

// Mini idol material: warm “amber-gold” (solid, not pastel)
function makeMiniMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffd39b,
    metalness: 0.55,
    roughness: 0.35,
    emissive: new THREE.Color(0x2b1306),
    emissiveIntensity: 0.22,
  });
  m.transparent = false;
  m.opacity = 1;
  return m;
}

// ====== niche materials (frame + backlight + glass) ======
const nicheFrameMat = new THREE.MeshStandardMaterial({
  color: 0x1c120c,    // dark “wood”
  metalness: 0.08,
  roughness: 0.92,
});

const nicheBackMat = new THREE.MeshStandardMaterial({
  color: 0x160b07,
  emissive: new THREE.Color(0xffa85a),
  emissiveIntensity: 1.2,
  roughness: 1.0,
  metalness: 0.0,
});

const nicheGlassMat = new THREE.MeshStandardMaterial({
  color: 0xffd5a8,
  transparent: true,
  opacity: 0.08,
  roughness: 0.25,
  metalness: 0.0,
  emissive: new THREE.Color(0xffb877),
  emissiveIntensity: 0.08,
});

// ====== loaders ======
const objLoader = new OBJLoader(manager);
let godObj = null;
let godTemplate = null;
let mainScale = 1;

// template bbox in “template local” space
let templateSize = new THREE.Vector3(1, 1, 1);

// Queue donations until model is loaded
const pendingDonations = [];

// Mini pool: { group, createdAt, expiresAt }
const minis = [];
let nextMiniIndex = 0;

function cloneMiniMesh(templateGroup) {
  const clone = templateGroup.clone(true);
  clone.traverse((child) => {
    if (child && child.isMesh) {
      child.material = makeMiniMaterial();
      if (child.geometry) child.geometry.computeVertexNormals();
    }
  });
  return clone;
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

// Build a “niche” around a mini: frame + backlight + glass
function buildNicheForMini(miniScale) {
  const w = templateSize.x * miniScale * MINI.nichePadX;
  const h = templateSize.y * miniScale * MINI.nichePadY;
  const d = MINI.nicheDepth;

  const g = new THREE.Group();

  // backlight panel
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), nicheBackMat.clone());
  back.position.set(0, 0, -d * 0.35);
  g.add(back);

  // frame (thin box)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, h * 1.06, d), nicheFrameMat);
  frame.position.set(0, 0, -d * 0.5);
  g.add(frame);

  // glass (very subtle)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), nicheGlassMat.clone());
  glass.position.set(0, 0, d * 0.12);
  g.add(glass);

  return g;
}

function placeInGrid(group, index) {
  const c = index % WALL.cols;
  const r = Math.floor(index / WALL.cols) % WALL.rows;

  const totalW = (WALL.cols - 1) * WALL.spacingX;
  const x = (c * WALL.spacingX) - totalW / 2;
  const y = WALL.y0 + r * WALL.spacingY;
  const z = WALL.z;

  group.position.set(x, y, z);
}

function spawnMini({ username, amount }) {
  if (!godTemplate) {
    pendingDonations.push({ username, amount });
    return;
  }

  // build mini group: niche + mini inside
  const mini = cloneMiniMesh(godTemplate);

  // scale minis relative to main scale
  const miniScale = mainScale * MINI.scaleFactor;
  mini.scale.setScalar(miniScale);

  // niche surrounds the mini (same placement)
  const niche = buildNicheForMini(miniScale);

  // put mini slightly in front of backlight
  mini.position.set(0, (-templateSize.y * miniScale) * 0.02, 0.12);

  // tiny random yaw for hand-made feel
  mini.rotation.set(0, (Math.random() - 0.5) * 0.12, 0);

  const group = new THREE.Group();
  group.add(niche);
  group.add(mini);

  placeInGrid(group, nextMiniIndex++);
  scene.add(group);

  const createdAt = Date.now();
  const expiresAt = createdAt + BLESS_MS;
  minis.push({ group, createdAt, expiresAt });

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

    // Center & scale
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

    // sit on y=0
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y += (0.0 - box2.min.y);

    obj.rotation.y = Math.PI;

    scene.add(obj);
    godObj = obj;

    // Template for minis: clone AFTER centering/scaling so bbox is correct
    godTemplate = obj.clone(true);
    godTemplate.position.set(0, 0, 0);
    godTemplate.rotation.set(0, 0, 0);

    // compute template size at scale=1 (we’ll use it for niche sizing)
    // We temporarily remove scale to measure “unit template”
    const tmp = godTemplate.clone(true);
    tmp.scale.setScalar(1);
    const b = new THREE.Box3().setFromObject(tmp);
    const s = new THREE.Vector3();
    b.getSize(s);
    templateSize.copy(s);

    // flush queued donations
    while (pendingDonations.length) spawnMini(pendingDonations.shift());

    console.log("[obj] loaded main + template", PATHS.obj, "templateSize:", templateSize);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== Donation hook ======
window.gongdeDonate = function gongdeDonate({ username, amount }) {
  spawnMini({ username: String(username), amount: String(amount) });
};

// ===== Supabase Realtime =====
async function startRealtime() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[realtime] missing keys");
    return;
  }

  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  supabase
    .channel("gongde-donations")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "donations" }, (payload) => {
      const row = payload.new;
      const name = row.name || row.username || "善信";
      const amount = row.amount ?? 0;
      console.log("[realtime] donation:", row);
      window.gongdeDonate({ username: String(name), amount: String(amount) });
    })
    .subscribe((status) => console.log("[realtime] status:", status));
}
startRealtime();

// Local same-device testing fallback (optional)
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

  // rotate MAIN idol only
  if (godObj) godObj.rotation.y += dt * MAIN.rotateSpeed;

  // fade + remove minis
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
