import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

console.log("shrine.js loaded OK");
console.log("VERSION: centered-nudge", Date.now());

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

// Put the statue "feet" on top of the pedestal.
// Your pedestal top is ~0.45 (cylinder height 0.45, centered at y=0.22)
const PEDESTAL_TOP_Y = 0.45;

// Manual nudges (edit these after you see it)
const NUDGE_X = 0.0;   // + moves right, - moves left
const NUDGE_Z = 0.0;   // + moves toward camera, - moves away

// ====== DOM ======
const canvas = document.getElementById("scene");
const tilesEl = document.getElementById("tiles");

// ====== THREE SETUP ======
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
camera.position.set(0, 6.0, 32.0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 6.0, 0);
controls.update();

// ---- Lights (stable) ----
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 5, 2);
scene.add(key);
const fill = new THREE.DirectionalLight(0xb7c9ff, 0.35);
fill.position.set(-3, 2, -2);
scene.add(fill);
const candle = new THREE.PointLight(0xffb07a, 0.25, 14);
candle.position.set(0.0, 1.2, 1.2);
scene.add(candle);

// ---- Pedestal ----
const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(0.65, 0.85, 0.45, 48),
  new THREE.MeshStandardMaterial({ color: 0x1a1412, metalness: 0.15, roughness: 0.9 })
);
pedestal.position.set(0, 0.22, 0);
scene.add(pedestal);

// ---- Ground ----
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x07060a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

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

const godMaterial = new THREE.MeshStandardMaterial({
  map: diffuseMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  roughness: 1.0,
  metalness: 0.0,
});

const objLoader = new OBJLoader(manager);
let godObj = null;

objLoader.load(
  PATHS.obj,
  (obj) => {
    obj.traverse((child) => {
      if (child && child.isMesh) {
        child.material = godMaterial;
        if (child.geometry) child.geometry.computeVertexNormals();
      }
    });

    // Bounds before scaling
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    console.log("[obj] bbox size:", size.x, size.y, size.z, "center:", center.x, center.y, center.z);

    // Center X/Z around origin (remove bbox center)
    obj.position.x -= center.x;
    obj.position.z -= center.z;

    // Scale huge
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const target = 18.0;
    const s = target / maxDim;
    obj.scale.setScalar(s);

    console.log("[obj] SCALE APPLIED:", s, "target:", target, "maxDim:", maxDim);

    // Recompute bounds AFTER scaling & X/Z center so we can plant feet
    const box2 = new THREE.Box3().setFromObject(obj);
    const minY = box2.min.y;

    // Plant the base on the pedestal top
    obj.position.y += (PEDESTAL_TOP_Y - minY);

    // Manual nudges (for “visual center”)
    obj.position.x += NUDGE_X;
    obj.position.z += NUDGE_Z;

    obj.rotation.y = Math.PI;

    scene.add(obj);
    godObj = obj;

    // Force consistent view
    controls.reset();
    controls.target.set(0 + NUDGE_X, 6.0, 0 + NUDGE_Z);
    camera.position.set(0, 10.0, 40.0);
    camera.lookAt(controls.target);
    controls.update();

    console.log("[obj] loaded + centered-ish:", PATHS.obj);
  },
  undefined,
  (err) => console.error("[obj] FAILED:", err)
);

// ====== DONATION WALL ======
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function spawnBlessingTile({ username, amount }) {
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.innerHTML = `<div class="glow"></div><div class="name">${escapeHtml(username)} · ¥${amount}</div>`;
  tilesEl.prepend(tile);

  setTimeout(() => {
    tile.style.transition = "opacity 600ms ease, transform 600ms ease";
    tile.style.opacity = "0";
    tile.style.transform = "scale(0.9)";
    setTimeout(() => tile.remove(), 650);
  }, 60000);
}

// ====== SPEECH ======
let speechEnabled = false;
document.getElementById("enable-audio").addEventListener("click", () => {
  speechEnabled = true;
  speak("功德系统已启动。欢迎供奉。");
});

function speak(text) {
  if (!speechEnabled || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 0.7;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function onDonationEvent({ username, amount }) {
  spawnBlessingTile({ username, amount });
  speak(`感谢善信 ${username}，供奉 ${amount} 元。功德无量，福报增长。`);
}

document.getElementById("test-donate").addEventListener("click", () => {
  const username = "善信_" + Math.random().toString(16).slice(2, 6).toUpperCase();
  const amount = (Math.random() * 90 + 1).toFixed(2);
  onDonationEvent({ username, amount });
});

// ====== RENDER LOOP ======
renderer.setAnimationLoop(() => {
  controls.update();
  if (godObj) godObj.rotation.y += 0.0012;
  candle.intensity = 0.22 + Math.random() * 0.08;
  renderer.render(scene, camera);
});
